# Video Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `video-studio/` toolkit that turns any running web app into a polished demo video through a staged `capture → narrate → render` pipeline driven entirely by per-product config.

**Architecture:** A product-agnostic `engine/` and per-product `products/<name>/` folders. Three stages communicate only through JSON manifests on disk: `capture` (Playwright → screenshots/clips), `narrate` (ElevenLabs TTS → audio + measured durations), `render` (Remotion → mp4). `render` consumes only files the prior stages wrote, so it never touches a browser or network. External I/O (browser, TTS) lives behind narrow interfaces (`PageDriver`, `TtsProvider`) so all pipeline logic is unit-tested with fakes.

**Tech Stack:** Bun 1.3.3 (runtime + `bun:test`), TypeScript, Zod 4, Playwright 1.55, Remotion 4.0.448 (`remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/transitions`), React 19, ElevenLabs REST API via `fetch`.

**Note on the existing `manasik-demo/` folder:** it holds two markdown specs only. Task 13 ports that storyboard into the typed model at `video-studio/products/manasik/`. The markdown files stay as reference; nothing in `manasik-demo/` is deleted by this plan.

---

## File Structure

```
video-studio/
  package.json              # standalone; own deps + own bun install (NOT a workspace member)
  tsconfig.json
  bunfig.toml
  .gitignore                # ignores products/*/{assets,audio,manifests,out}
  remotion.config.ts        # Remotion Studio/render config
  engine/
    schema.ts               # Zod schemas + inferred types for Scene/Storyboard/ProductConfig
    paths.ts                # per-product path helpers (assets/audio/manifests/out dirs)
    hash.ts                 # stable hash of a storyboard slice (cache key)
    manifest.ts             # read/write capture.json & audio.json + manifest types
    config.ts               # load + validate product.config.ts and storyboard.ts
    duration.ts             # resolveFinalSec() — pure duration resolution
    capture/
      types.ts              # PageDriver interface + CaptureResult
      capture.ts            # runCapture(storyboard, config, driver) → CaptureManifest
      playwright-driver.ts  # real PageDriver backed by Playwright
    narrate/
      types.ts              # TtsProvider interface + TtsResult
      narrate.ts            # runNarrate(storyboard, config, provider, captureDir) → AudioManifest
      elevenlabs.ts         # real TtsProvider via ElevenLabs REST (with-timestamps)
    render/
      schedule.ts           # computeSchedule() — pure storyboard+manifests → timeline
      theme.tsx             # ThemeProvider/useTheme React context
      components/
        Caption.tsx
        KenBurns.tsx
        TitleCard.tsx
      Video.tsx             # maps schedule → TransitionSeries
      Root.tsx              # registers one <Composition> per product
      index.ts              # registerRoot(Root)
    cli.ts                  # arg parse + orchestrate stages (entry point)
  products/
    manasik/
      product.config.ts
      storyboard.ts
  fixtures/
    static-app/index.html   # tiny served page used by capture + e2e tests
    demo/product.config.ts  # 2-scene fixture product
    demo/storyboard.ts
```

---

## Task 0: Scaffold the standalone toolkit

**Files:**
- Create: `video-studio/package.json`
- Create: `video-studio/tsconfig.json`
- Create: `video-studio/bunfig.toml`
- Create: `video-studio/.gitignore`
- Create: `video-studio/engine/.keep`

- [ ] **Step 1: Create `video-studio/package.json`**

```json
{
  "name": "video-studio",
  "private": true,
  "type": "module",
  "scripts": {
    "video": "bun run engine/cli.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "preview": "remotion studio engine/index.ts"
  },
  "dependencies": {
    "@remotion/bundler": "4.0.448",
    "@remotion/cli": "4.0.448",
    "@remotion/renderer": "4.0.448",
    "@remotion/transitions": "4.0.448",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "remotion": "4.0.448",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@types/bun": "1.3.3",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "playwright": "1.55.1",
    "typescript": "5.7.2"
  }
}
```

- [ ] **Step 2: Create `video-studio/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun", "react", "react-dom"],
    "lib": ["ESNext", "DOM"],
    "noEmit": true
  },
  "include": ["engine", "products", "fixtures"]
}
```

- [ ] **Step 3: Create `video-studio/bunfig.toml`**

```toml
[test]
root = "."
```

- [ ] **Step 4: Create `video-studio/.gitignore`**

```gitignore
node_modules
products/*/assets/
products/*/audio/
products/*/manifests/
products/*/out/
fixtures/*/assets/
fixtures/*/audio/
fixtures/*/manifests/
fixtures/*/out/
```

- [ ] **Step 5: Create placeholder `video-studio/engine/.keep`**

Empty file so the directory exists before the first module lands.

- [ ] **Step 6: Install dependencies (standalone)**

Run: `cd video-studio && bun install`
Expected: a `bun.lock` and `node_modules/` appear inside `video-studio/`. `video-studio` is NOT matched by the root `packages/**` workspace glob, so this install is independent of the Remotion fork.

- [ ] **Step 7: Verify the test runner boots**

Run: `cd video-studio && bun test`
Expected: exits 0 with "0 tests" (no test files yet). If it errors about no tests, that is acceptable — proceed.

- [ ] **Step 8: Commit**

```bash
git add video-studio/package.json video-studio/tsconfig.json video-studio/bunfig.toml video-studio/.gitignore video-studio/engine/.keep video-studio/bun.lock
git commit -m "video-studio: scaffold standalone toolkit package"
```

---

## Task 1: Schema and validation

**Files:**
- Create: `video-studio/engine/schema.ts`
- Test: `video-studio/engine/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`video-studio/engine/schema.test.ts`:

```ts
import { test, expect } from "bun:test";
import { parseStoryboard, parseProductConfig } from "./schema";

const validScene = {
  id: "01-title",
  capture: { kind: "titlecard", logo: true },
  caption: { primary: "مناسك", secondary: "Manasik" },
  narration: "Manasik — unified operations.",
  duration: "auto",
  transitionOut: "fade",
};

test("accepts a valid storyboard", () => {
  const sb = parseStoryboard({ scenes: [validScene] });
  expect(sb.scenes[0]!.id).toBe("01-title");
});

test("rejects an unknown capture kind with a path", () => {
  expect(() => parseStoryboard({ scenes: [{ ...validScene, capture: { kind: "video" } }] }))
    .toThrow(/capture/);
});

test("rejects duration 'auto' without narration", () => {
  const noNarration = { ...validScene };
  delete (noNarration as Record<string, unknown>).narration;
  expect(() => parseStoryboard({ scenes: [noNarration] })).toThrow(/narration/);
});

test("rejects an empty scenes array", () => {
  expect(() => parseStoryboard({ scenes: [] })).toThrow();
});

test("accepts a valid product config", () => {
  const cfg = parseProductConfig({
    appUrl: "http://localhost:3000",
    theme: {
      palette: { bg: "#0d110d", fg: "#fff", accent: "#c8a45c" },
      fonts: { heading: "Tajawal", body: "Tajawal" },
      direction: "rtl",
    },
    output: { width: 1920, height: 1080, fps: 30 },
    locale: { primary: "ar", secondary: "en" },
  });
  expect(cfg.output.fps).toBe(30);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Write `video-studio/engine/schema.ts`**

```ts
import { z } from "zod";

export const localizedText = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1).optional(),
});

export const step = z.discriminatedUnion("action", [
  z.object({ action: z.literal("click"), selector: z.string() }),
  z.object({ action: z.literal("type"), selector: z.string(), text: z.string() }),
  z.object({
    action: z.literal("scroll"),
    selector: z.string().optional(),
    to: z.union([z.literal("bottom"), z.literal("top"), z.number()]),
  }),
  z.object({ action: z.literal("wait"), for: z.union([z.string(), z.number()]) }),
]);

export const capture = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("screenshot"), route: z.string(), waitFor: z.string().optional() }),
  z.object({
    kind: z.literal("interaction"),
    route: z.string(),
    steps: z.array(step).min(1),
    waitFor: z.string().optional(),
  }),
  z.object({ kind: z.literal("titlecard"), bg: z.string().optional(), logo: z.boolean().optional() }),
]);

export const scene = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "id must be lower-kebab-case"),
    capture,
    caption: localizedText.optional(),
    narration: z.string().min(1).optional(),
    duration: z.union([z.number().positive(), z.literal("auto")]),
    motion: z.enum(["kenburns", "none"]).optional(),
    transitionOut: z.enum(["cut", "fade", "slide"]).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.duration === "auto" && !s.narration) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: "duration 'auto' requires narration (nothing to fit to)",
      });
    }
  });

export const storyboard = z.object({
  scenes: z.array(scene).min(1),
  defaults: z
    .object({
      transitionOut: z.enum(["cut", "fade", "slide"]).optional(),
      motion: z.enum(["kenburns", "none"]).optional(),
      duration: z.number().positive().optional(),
    })
    .optional(),
});

export const productConfig = z.object({
  appUrl: z.string().url(),
  theme: z.object({
    palette: z.object({ bg: z.string(), fg: z.string(), accent: z.string() }),
    fonts: z.object({ heading: z.string(), body: z.string() }),
    direction: z.enum(["rtl", "ltr"]),
    logo: z.string().optional(),
  }),
  output: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
  locale: z.object({ primary: z.string(), secondary: z.string().optional() }),
  voice: z.object({ id: z.string(), modelId: z.string().optional() }).optional(),
});

export type LocalizedText = z.infer<typeof localizedText>;
export type Step = z.infer<typeof step>;
export type Capture = z.infer<typeof capture>;
export type Scene = z.infer<typeof scene>;
export type Storyboard = z.infer<typeof storyboard>;
export type ProductConfigData = z.infer<typeof productConfig>;

/** Hooks live alongside the validated data in a product.config.ts default export. */
export type ProductConfig = ProductConfigData & {
  prime?: (page: unknown) => void | Promise<void>;
  resolveRoute?: (route: string) => string | Promise<string>;
};

export function parseStoryboard(input: unknown): Storyboard {
  return storyboard.parse(input);
}

/** Validates the data fields, then returns the ORIGINAL object so function hooks survive. */
export function parseProductConfig(input: unknown): ProductConfig {
  productConfig.parse(input);
  return input as ProductConfig;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/schema.ts video-studio/engine/schema.test.ts
git commit -m "video-studio: Zod schema for storyboard + product config"
```

---

## Task 2: Per-product path helpers

**Files:**
- Create: `video-studio/engine/paths.ts`
- Test: `video-studio/engine/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`video-studio/engine/paths.test.ts`:

```ts
import { test, expect } from "bun:test";
import { productPaths } from "./paths";

test("derives all product subpaths from a root", () => {
  const p = productPaths("/repo/video-studio", "manasik");
  expect(p.dir).toBe("/repo/video-studio/products/manasik");
  expect(p.assets).toBe("/repo/video-studio/products/manasik/assets");
  expect(p.audio).toBe("/repo/video-studio/products/manasik/audio");
  expect(p.manifests).toBe("/repo/video-studio/products/manasik/manifests");
  expect(p.out).toBe("/repo/video-studio/products/manasik/out");
  expect(p.captureManifest).toBe("/repo/video-studio/products/manasik/manifests/capture.json");
  expect(p.audioManifest).toBe("/repo/video-studio/products/manasik/manifests/audio.json");
  expect(p.config).toBe("/repo/video-studio/products/manasik/product.config.ts");
  expect(p.storyboard).toBe("/repo/video-studio/products/manasik/storyboard.ts");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/paths.test.ts`
Expected: FAIL — `Cannot find module './paths'`.

- [ ] **Step 3: Write `video-studio/engine/paths.ts`**

```ts
import { join } from "node:path";

export type ProductPaths = {
  dir: string;
  assets: string;
  audio: string;
  manifests: string;
  out: string;
  captureManifest: string;
  audioManifest: string;
  config: string;
  storyboard: string;
};

/** `root` is the video-studio package dir; products live under `<root>/products` or `<root>/fixtures`. */
export function productPaths(root: string, name: string, base = "products"): ProductPaths {
  const dir = join(root, base, name);
  const manifests = join(dir, "manifests");
  return {
    dir,
    assets: join(dir, "assets"),
    audio: join(dir, "audio"),
    manifests,
    out: join(dir, "out"),
    captureManifest: join(manifests, "capture.json"),
    audioManifest: join(manifests, "audio.json"),
    config: join(dir, "product.config.ts"),
    storyboard: join(dir, "storyboard.ts"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/paths.ts video-studio/engine/paths.test.ts
git commit -m "video-studio: per-product path helpers"
```

---

## Task 3: Stable hashing for cache keys

**Files:**
- Create: `video-studio/engine/hash.ts`
- Test: `video-studio/engine/hash.test.ts`

- [ ] **Step 1: Write the failing test**

`video-studio/engine/hash.test.ts`:

```ts
import { test, expect } from "bun:test";
import { hashValue } from "./hash";

test("is stable regardless of key order", () => {
  expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
});

test("changes when content changes", () => {
  expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
});

test("returns a short hex string", () => {
  expect(hashValue({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/hash.test.ts`
Expected: FAIL — `Cannot find module './hash'`.

- [ ] **Step 3: Write `video-studio/engine/hash.ts`**

```ts
import { createHash } from "node:crypto";

/** Deterministic JSON stringify with sorted object keys. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}

/** 16-hex-char content hash, stable across key ordering. Used as a per-scene cache key. */
export function hashValue(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/hash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/hash.ts video-studio/engine/hash.test.ts
git commit -m "video-studio: stable content hashing for cache keys"
```

---

## Task 4: Manifest types + read/write

**Files:**
- Create: `video-studio/engine/manifest.ts`
- Test: `video-studio/engine/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

`video-studio/engine/manifest.test.ts`:

```ts
import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import {
  writeCaptureManifest,
  readCaptureManifest,
  writeAudioManifest,
  readAudioManifest,
  type CaptureManifest,
  type AudioManifest,
} from "./manifest";

test("round-trips a capture manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  const path = join(dir, "capture.json");
  const m: CaptureManifest = {
    scenes: [{ id: "01-title", kind: "titlecard", asset: "assets/01-title.png", ok: true, w: 1920, h: 1080, hash: "abc" }],
  };
  await writeCaptureManifest(path, m);
  expect(await readCaptureManifest(path)).toEqual(m);
});

test("round-trips an audio manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  const path = join(dir, "audio.json");
  const m: AudioManifest = {
    scenes: [{ id: "01-title", audio: "audio/01-title.mp3", audioSec: 3.2, finalSec: 3.6, hash: "abc" }],
  };
  await writeAudioManifest(path, m);
  expect(await readAudioManifest(path)).toEqual(m);
});

test("reading a missing manifest returns null", async () => {
  expect(await readCaptureManifest("/no/such/capture.json")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/manifest.test.ts`
Expected: FAIL — `Cannot find module './manifest'`.

- [ ] **Step 3: Write `video-studio/engine/manifest.ts`**

```ts
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type CaptureSceneEntry = {
  id: string;
  kind: "screenshot" | "interaction" | "titlecard";
  asset: string; // relative to the product dir
  ok: boolean;
  w?: number;
  h?: number;
  hash: string; // hash of the scene's capture slice
};
export type CaptureManifest = { scenes: CaptureSceneEntry[] };

export type AudioSceneEntry = {
  id: string;
  audio: string | null; // relative path, or null when no narration
  audioSec: number | null;
  finalSec: number;
  hash: string; // hash of the scene's narration+duration slice
};
export type AudioManifest = { scenes: AudioSceneEntry[] };

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(value, null, 2));
}

async function readJson<T>(path: string): Promise<T | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return (await file.json()) as T;
}

export const writeCaptureManifest = (path: string, m: CaptureManifest) => writeJson(path, m);
export const readCaptureManifest = (path: string) => readJson<CaptureManifest>(path);
export const writeAudioManifest = (path: string, m: AudioManifest) => writeJson(path, m);
export const readAudioManifest = (path: string) => readJson<AudioManifest>(path);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/manifest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/manifest.ts video-studio/engine/manifest.test.ts
git commit -m "video-studio: manifest types + read/write helpers"
```

---

## Task 5: Duration resolution (pure)

**Files:**
- Create: `video-studio/engine/duration.ts`
- Test: `video-studio/engine/duration.test.ts`

- [ ] **Step 1: Write the failing test**

`video-studio/engine/duration.test.ts`:

```ts
import { test, expect } from "bun:test";
import { resolveFinalSec, AUDIO_PADDING_SEC } from "./duration";
import type { Scene, Storyboard } from "./schema";

const base = (over: Partial<Scene>): Scene =>
  ({ id: "s", capture: { kind: "titlecard" }, duration: 5, ...over }) as Scene;

const defaults: Storyboard["defaults"] = { duration: 4 };

test("auto with audio = audio + padding", () => {
  const s = base({ duration: "auto", narration: "hi" });
  expect(resolveFinalSec(s, 5.8, defaults)).toBeCloseTo(5.8 + AUDIO_PADDING_SEC);
});

test("numeric with audio = max(audio, numeric) so VO never clips", () => {
  expect(resolveFinalSec(base({ duration: 5 }), 6.2, defaults)).toBeCloseTo(6.2);
  expect(resolveFinalSec(base({ duration: 8 }), 6.2, defaults)).toBeCloseTo(8);
});

test("numeric, no audio = authored number", () => {
  expect(resolveFinalSec(base({ duration: 5 }), null, defaults)).toBe(5);
});

test("auto, no audio = falls back to defaults.duration", () => {
  expect(resolveFinalSec(base({ duration: "auto", narration: "hi" }), null, defaults)).toBe(4);
});

test("auto, no audio, no default = throws naming the scene", () => {
  const s = base({ id: "boom", duration: "auto", narration: "hi" });
  expect(() => resolveFinalSec(s, null, undefined)).toThrow(/boom/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/duration.test.ts`
Expected: FAIL — `Cannot find module './duration'`.

- [ ] **Step 3: Write `video-studio/engine/duration.ts`**

```ts
import type { Scene, Storyboard } from "./schema";

export const AUDIO_PADDING_SEC = 0.4;

/**
 * Resolve a scene's final on-screen length in seconds.
 * - `auto` + audio  → audio length + padding (so the VO has room to breathe)
 * - numeric + audio → max(audio, numeric) so narration is never cut off
 * - numeric, no audio → the authored number
 * - `auto`, no audio → defaults.duration if present, else a hard error
 */
export function resolveFinalSec(
  scene: Scene,
  audioSec: number | null,
  defaults: Storyboard["defaults"],
): number {
  const authored = scene.duration === "auto" ? null : scene.duration;

  if (audioSec != null) {
    return authored != null ? Math.max(audioSec, authored) : audioSec + AUDIO_PADDING_SEC;
  }

  const fallback = authored ?? defaults?.duration;
  if (fallback == null) {
    throw new Error(
      `scene "${scene.id}": duration is "auto" but no audio was generated and no defaults.duration is set`,
    );
  }
  return fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/duration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/duration.ts video-studio/engine/duration.test.ts
git commit -m "video-studio: pure duration resolution"
```

---

## Task 6: Product config loader

**Files:**
- Create: `video-studio/engine/config.ts`
- Create: `video-studio/fixtures/demo/product.config.ts`
- Create: `video-studio/fixtures/demo/storyboard.ts`
- Test: `video-studio/engine/config.test.ts`

- [ ] **Step 1: Create the fixture product config `video-studio/fixtures/demo/product.config.ts`**

```ts
import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:4599",
  theme: {
    palette: { bg: "#101010", fg: "#ffffff", accent: "#4ea3ff" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 1280, height: 720, fps: 30 },
  locale: { primary: "en" },
};

export default config;
```

- [ ] **Step 2: Create the fixture storyboard `video-studio/fixtures/demo/storyboard.ts`**

```ts
import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard", logo: false }, caption: { primary: "Demo" }, duration: 2, transitionOut: "fade" },
    { id: "02-home", capture: { kind: "screenshot", route: "/" }, caption: { primary: "Home" }, duration: 2, motion: "kenburns", transitionOut: "cut" },
  ],
};

export default storyboard;
```

- [ ] **Step 3: Write the failing test**

`video-studio/engine/config.test.ts`:

```ts
import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadProduct } from "./config";

const ROOT = join(import.meta.dir, "..");

test("loads + validates a fixture product", async () => {
  const { config, storyboard, paths } = await loadProduct(ROOT, "demo", "fixtures");
  expect(config.output.width).toBe(1280);
  expect(storyboard.scenes).toHaveLength(2);
  expect(paths.dir).toBe(join(ROOT, "fixtures", "demo"));
});

test("throws a clear error for a missing product", async () => {
  await expect(loadProduct(ROOT, "nope", "fixtures")).rejects.toThrow(/nope/);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd video-studio && bun test engine/config.test.ts`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 5: Write `video-studio/engine/config.ts`**

```ts
import { parseProductConfig, parseStoryboard, type ProductConfig, type Storyboard } from "./schema";
import { productPaths, type ProductPaths } from "./paths";

export type LoadedProduct = {
  config: ProductConfig;
  storyboard: Storyboard;
  paths: ProductPaths;
};

/** Dynamically import a product's config + storyboard and validate both. */
export async function loadProduct(root: string, name: string, base = "products"): Promise<LoadedProduct> {
  const paths = productPaths(root, name, base);

  let configModule: { default?: unknown };
  let storyboardModule: { default?: unknown };
  try {
    configModule = await import(paths.config);
    storyboardModule = await import(paths.storyboard);
  } catch (cause) {
    throw new Error(`Could not load product "${name}" from ${paths.dir}: ${(cause as Error).message}`);
  }

  const config = parseProductConfig(configModule.default);
  const storyboard = parseStoryboard(storyboardModule.default);
  return { config, storyboard, paths };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd video-studio && bun test engine/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add video-studio/engine/config.ts video-studio/engine/config.test.ts video-studio/fixtures/demo/product.config.ts video-studio/fixtures/demo/storyboard.ts
git commit -m "video-studio: product loader + demo fixture product"
```

---

## Task 7: Capture stage logic (with a fake PageDriver)

**Files:**
- Create: `video-studio/engine/capture/types.ts`
- Create: `video-studio/engine/capture/capture.ts`
- Test: `video-studio/engine/capture/capture.test.ts`

- [ ] **Step 1: Create the driver interface `video-studio/engine/capture/types.ts`**

```ts
import type { Capture, ProductConfig } from "../schema";

export type ScreenshotRequest = {
  kind: "screenshot" | "titlecard";
  route?: string; // absolute url; undefined for titlecard
  waitFor?: string;
  outPath: string; // absolute path to write the PNG
  capture: Capture; // full capture node (titlecard bg/logo, etc.)
};

export type ClipRequest = {
  kind: "interaction";
  route: string; // absolute url
  capture: Extract<Capture, { kind: "interaction" }>;
  outPath: string; // absolute path to write the clip
};

export type DriverResult = { bytes: number; w: number; h: number };

/** Narrow seam over Playwright so the capture stage is testable without a browser. */
export type PageDriver = {
  /** Probe `config.appUrl` is reachable; throw if not. Run once before captures. */
  health(config: ProductConfig): Promise<void>;
  screenshot(req: ScreenshotRequest, config: ProductConfig): Promise<DriverResult>;
  clip(req: ClipRequest, config: ProductConfig): Promise<DriverResult>;
  close(): Promise<void>;
};

export const MIN_ASSET_BYTES = 8 * 1024; // a blank page screenshots to ~5 KB
```

- [ ] **Step 2: Write the failing test**

`video-studio/engine/capture/capture.test.ts`:

```ts
import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { runCapture } from "./capture";
import type { PageDriver } from "./types";
import type { Storyboard, ProductConfig } from "../schema";

const config: ProductConfig = {
  appUrl: "http://localhost:9999",
  theme: { palette: { bg: "#000", fg: "#fff", accent: "#f00" }, fonts: { heading: "A", body: "A" }, direction: "ltr" },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
};

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard" }, duration: 2 },
    { id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2 },
    { id: "03-flow", capture: { kind: "interaction", route: "/x", steps: [{ action: "click", selector: "#b" }] }, duration: 2 },
  ],
};

function fakeDriver(over: Partial<PageDriver> = {}): PageDriver {
  return {
    health: async () => {},
    screenshot: async () => ({ bytes: 50_000, w: 1920, h: 1080 }),
    clip: async () => ({ bytes: 200_000, w: 1920, h: 1080 }),
    close: async () => {},
    ...over,
  };
}

test("captures every scene and writes a manifest entry per scene", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-"));
  const m = await runCapture({ storyboard, config, driver: fakeDriver(), assetsDir: dir, productDir: dir });
  expect(m.scenes.map((s) => s.id)).toEqual(["01-title", "02-home", "03-flow"]);
  expect(m.scenes.every((s) => s.ok)).toBe(true);
  expect(m.scenes[2]!.kind).toBe("interaction");
});

test("calls resolveRoute to substitute dynamic placeholders", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-"));
  const seen: string[] = [];
  const sb: Storyboard = { scenes: [{ id: "05-guest", capture: { kind: "screenshot", route: "/guests/[firstId]" }, duration: 2 }] };
  const cfg: ProductConfig = { ...config, resolveRoute: (r) => r.replace("[firstId]", "g-1") };
  await runCapture({
    storyboard: sb,
    config: cfg,
    assetsDir: dir,
    productDir: dir,
    driver: fakeDriver({ screenshot: async (req) => { seen.push(req.route!); return { bytes: 50_000, w: 1, h: 1 }; } }),
  });
  expect(seen[0]).toBe("http://localhost:9999/guests/g-1");
});

test("fails the scene when an asset is below the min size", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-"));
  const m = await runCapture({
    storyboard: { scenes: [{ id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2 }] },
    config,
    assetsDir: dir,
    productDir: dir,
    driver: fakeDriver({ screenshot: async () => ({ bytes: 1_000, w: 1, h: 1 }) }),
  });
  expect(m.scenes[0]!.ok).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd video-studio && bun test engine/capture/capture.test.ts`
Expected: FAIL — `Cannot find module './capture'`.

- [ ] **Step 4: Write `video-studio/engine/capture/capture.ts`**

```ts
import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ProductConfig, Storyboard } from "../schema";
import { hashValue } from "../hash";
import type { CaptureManifest, CaptureSceneEntry } from "../manifest";
import { MIN_ASSET_BYTES, type PageDriver } from "./types";

export type RunCaptureArgs = {
  storyboard: Storyboard;
  config: ProductConfig;
  driver: PageDriver;
  assetsDir: string; // absolute dir to write assets into
  productDir: string; // absolute product root (manifest paths are relative to this)
};

function joinUrl(base: string, route: string): string {
  return base.replace(/\/$/, "") + (route.startsWith("/") ? route : `/${route}`);
}

export async function runCapture(args: RunCaptureArgs): Promise<CaptureManifest> {
  const { storyboard, config, driver, assetsDir, productDir } = args;
  await mkdir(assetsDir, { recursive: true });
  await driver.health(config);

  const scenes: CaptureSceneEntry[] = [];
  try {
    for (const scene of storyboard.scenes) {
      const cap = scene.capture;
      const ext = cap.kind === "interaction" ? "mp4" : "png";
      const outPath = join(assetsDir, `${scene.id}.${ext}`);
      const asset = relative(productDir, outPath);
      const hash = hashValue(cap);

      try {
        let result: { bytes: number; w: number; h: number };
        if (cap.kind === "interaction") {
          const route = await resolveRoute(config, cap.route);
          result = await driver.clip({ kind: "interaction", route: joinUrl(config.appUrl, route), capture: cap, outPath }, config);
        } else if (cap.kind === "screenshot") {
          const route = await resolveRoute(config, cap.route);
          result = await driver.screenshot(
            { kind: "screenshot", route: joinUrl(config.appUrl, route), waitFor: cap.waitFor, outPath, capture: cap },
            config,
          );
        } else {
          result = await driver.screenshot({ kind: "titlecard", outPath, capture: cap }, config);
        }

        const ok = result.bytes >= MIN_ASSET_BYTES;
        if (!ok) {
          console.error(`✗ ${scene.id}: asset only ${result.bytes} bytes (< ${MIN_ASSET_BYTES}); likely blank/redirect`);
        }
        scenes.push({ id: scene.id, kind: cap.kind, asset, ok, w: result.w, h: result.h, hash });
      } catch (cause) {
        console.error(`✗ ${scene.id}: capture failed — ${(cause as Error).message}`);
        scenes.push({ id: scene.id, kind: cap.kind, asset, ok: false, hash });
      }
    }
  } finally {
    await driver.close();
  }

  return { scenes };
}

async function resolveRoute(config: ProductConfig, route: string): Promise<string> {
  return config.resolveRoute ? config.resolveRoute(route) : route;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd video-studio && bun test engine/capture/capture.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add video-studio/engine/capture/types.ts video-studio/engine/capture/capture.ts video-studio/engine/capture/capture.test.ts
git commit -m "video-studio: capture stage logic with fake-driver tests"
```

---

## Task 8: Real Playwright driver

**Files:**
- Create: `video-studio/engine/capture/playwright-driver.ts`
- Create: `video-studio/fixtures/static-app/index.html`
- Test: `video-studio/engine/capture/playwright-driver.test.ts`

- [ ] **Step 1: Install Playwright's Chromium**

Run: `cd video-studio && bunx playwright install chromium`
Expected: downloads Chromium. (Skip if already installed.)

- [ ] **Step 2: Create `video-studio/fixtures/static-app/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>body{margin:0;background:#0d110d;color:#fff;font:48px Arial;display:grid;place-items:center;height:100vh}</style>
  </head>
  <body>
    <h1 id="title">Static App</h1>
    <button id="b" onclick="document.getElementById('title').textContent='Clicked'">Go</button>
  </body>
</html>
```

- [ ] **Step 3: Write `video-studio/engine/capture/playwright-driver.ts`**

```ts
import { chromium, type Browser, type Page } from "playwright";
import type { ProductConfig } from "../schema";
import type { ClipRequest, DriverResult, PageDriver, ScreenshotRequest } from "./types";

const TITLECARD_HTML = (bg: string, text: string) =>
  `<!doctype html><html><body style="margin:0;background:${bg};color:#fff;font:80px sans-serif;display:grid;place-items:center;height:100vh"><div>${text}</div></body></html>`;

export function createPlaywrightDriver(): PageDriver {
  let browser: Browser | null = null;

  async function newPage(config: ProductConfig): Promise<Page> {
    if (!browser) browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: config.output.width, height: config.output.height },
      deviceScaleFactor: 2,
      recordVideo: undefined,
    });
    const page = await context.newPage();
    if (config.prime) await config.prime(page);
    return page;
  }

  async function settle(page: Page, waitFor?: string): Promise<void> {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => (document as Document).fonts.ready);
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 10_000 });
    await page.waitForTimeout(600);
  }

  return {
    async health(config) {
      const page = await newPage(config);
      try {
        const res = await page.goto(config.appUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
        if (!res || !res.ok()) throw new Error(`app not healthy at ${config.appUrl} (status ${res?.status() ?? "none"})`);
      } finally {
        await page.context().close();
      }
    },

    async screenshot(req: ScreenshotRequest, config): Promise<DriverResult> {
      const page = await newPage(config);
      try {
        if (req.kind === "titlecard") {
          const cap = req.capture as { kind: "titlecard"; bg?: string };
          const bg = cap.bg ?? config.theme.palette.bg;
          await page.setContent(TITLECARD_HTML(bg, ""), { waitUntil: "networkidle" });
        } else {
          const res = await page.goto(req.route!, { waitUntil: "domcontentloaded", timeout: 15_000 });
          if (res && res.url().replace(/\/$/, "") !== req.route!.replace(/\/$/, "")) {
            throw new Error(`redirected to ${res.url()} (role/auth not primed?)`);
          }
          await settle(page, req.waitFor);
        }
        await page.screenshot({ path: req.outPath, type: "png", fullPage: false });
        const bytes = (await Bun.file(req.outPath).arrayBuffer()).byteLength;
        return { bytes, w: config.output.width, h: config.output.height };
      } finally {
        await page.context().close();
      }
    },

    async clip(req: ClipRequest, config): Promise<DriverResult> {
      if (!browser) browser = await chromium.launch();
      const context = await browser.newContext({
        viewport: { width: config.output.width, height: config.output.height },
        deviceScaleFactor: 1,
        recordVideo: { dir: req.outPath + ".dir", size: { width: config.output.width, height: config.output.height } },
      });
      const page = await context.newPage();
      if (config.prime) await config.prime(page);
      try {
        await page.goto(req.route, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await settle(page, req.capture.waitFor);
        for (const s of req.capture.steps) {
          if (s.action === "click") await page.click(s.selector);
          else if (s.action === "type") await page.fill(s.selector, s.text);
          else if (s.action === "scroll") {
            if (typeof s.to === "number") await page.mouse.wheel(0, s.to);
            else await page.evaluate((dir) => window.scrollTo(0, dir === "bottom" ? document.body.scrollHeight : 0), s.to);
          } else if (s.action === "wait") {
            if (typeof s.for === "number") await page.waitForTimeout(s.for);
            else await page.waitForSelector(s.for, { timeout: 10_000 });
          }
        }
        await page.waitForTimeout(400);
        const video = page.video();
        await context.close(); // finalizes the video file
        const tmp = await video!.path();
        await Bun.write(req.outPath, Bun.file(tmp));
        const bytes = (await Bun.file(req.outPath).arrayBuffer()).byteLength;
        return { bytes, w: config.output.width, h: config.output.height };
      } catch (cause) {
        await context.close().catch(() => {});
        throw cause;
      }
    },

    async close() {
      if (browser) {
        await browser.close();
        browser = null;
      }
    },
  };
}
```

- [ ] **Step 4: Write the integration test `video-studio/engine/capture/playwright-driver.test.ts`**

```ts
import { test, expect, afterAll } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createPlaywrightDriver } from "./playwright-driver";
import type { ProductConfig } from "../schema";

// Serve the static fixture so the driver has a real app to hit.
const server = Bun.serve({
  port: 0,
  fetch: () => new Response(Bun.file(join(import.meta.dir, "../../fixtures/static-app/index.html")), {
    headers: { "content-type": "text/html" },
  }),
});
const appUrl = `http://localhost:${server.port}`;

afterAll(() => server.stop(true));

const config: ProductConfig = {
  appUrl,
  theme: { palette: { bg: "#0d110d", fg: "#fff", accent: "#f00" }, fonts: { heading: "Arial", body: "Arial" }, direction: "ltr" },
  output: { width: 640, height: 360, fps: 30 },
  locale: { primary: "en" },
};

test("screenshots a real served page above the min size", async () => {
  const driver = createPlaywrightDriver();
  const dir = mkdtempSync(join(tmpdir(), "vs-pw-"));
  const outPath = join(dir, "home.png");
  await driver.health(config);
  const r = await driver.screenshot({ kind: "screenshot", route: appUrl + "/", outPath, capture: { kind: "screenshot", route: "/" } }, config);
  await driver.close();
  expect(r.bytes).toBeGreaterThan(8 * 1024);
}, 60_000);
```

- [ ] **Step 5: Run the integration test**

Run: `cd video-studio && bun test engine/capture/playwright-driver.test.ts`
Expected: PASS (1 test). If Chromium is missing, re-run Step 1.

- [ ] **Step 6: Commit**

```bash
git add video-studio/engine/capture/playwright-driver.ts video-studio/engine/capture/playwright-driver.test.ts video-studio/fixtures/static-app/index.html
git commit -m "video-studio: real Playwright PageDriver + integration test"
```

---

## Task 9: Narrate stage logic (with a fake TtsProvider)

**Files:**
- Create: `video-studio/engine/narrate/types.ts`
- Create: `video-studio/engine/narrate/narrate.ts`
- Test: `video-studio/engine/narrate/narrate.test.ts`

- [ ] **Step 1: Create the provider interface `video-studio/engine/narrate/types.ts`**

```ts
import type { ProductConfig } from "../schema";

export type TtsRequest = {
  text: string;
  outPath: string; // absolute path to write the audio file
  config: ProductConfig;
};

export type TtsResult = { durationSec: number };

/** Narrow seam over the TTS API so the narrate stage is testable without network. */
export type TtsProvider = {
  synthesize(req: TtsRequest): Promise<TtsResult>;
};
```

- [ ] **Step 2: Write the failing test**

`video-studio/engine/narrate/narrate.test.ts`:

```ts
import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { runNarrate } from "./narrate";
import type { TtsProvider } from "./types";
import type { Storyboard, ProductConfig } from "../schema";

const config: ProductConfig = {
  appUrl: "http://localhost:1",
  theme: { palette: { bg: "#000", fg: "#fff", accent: "#f00" }, fonts: { heading: "A", body: "A" }, direction: "ltr" },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "voice-1" },
};

function fakeProvider(sec = 5.8): TtsProvider {
  return { synthesize: async () => ({ durationSec: sec }) };
}

test("synthesizes narrated scenes and resolves finalSec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-"));
  const sb: Storyboard = {
    scenes: [{ id: "01-title", capture: { kind: "titlecard" }, narration: "Hello", duration: "auto" }],
  };
  const m = await runNarrate({ storyboard: sb, config, provider: fakeProvider(5.8), audioDir: dir, productDir: dir });
  expect(m.scenes[0]!.audioSec).toBeCloseTo(5.8);
  expect(m.scenes[0]!.finalSec).toBeCloseTo(5.8 + 0.4);
  expect(m.scenes[0]!.audio).toContain("01-title");
});

test("scenes without narration get null audio and authored finalSec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-"));
  const sb: Storyboard = { scenes: [{ id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 4 }] };
  const m = await runNarrate({ storyboard: sb, config, provider: fakeProvider(), audioDir: dir, productDir: dir });
  expect(m.scenes[0]!.audio).toBeNull();
  expect(m.scenes[0]!.audioSec).toBeNull();
  expect(m.scenes[0]!.finalSec).toBe(4);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd video-studio && bun test engine/narrate/narrate.test.ts`
Expected: FAIL — `Cannot find module './narrate'`.

- [ ] **Step 4: Write `video-studio/engine/narrate/narrate.ts`**

```ts
import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ProductConfig, Storyboard } from "../schema";
import { hashValue } from "../hash";
import { resolveFinalSec } from "../duration";
import type { AudioManifest, AudioSceneEntry } from "../manifest";
import type { TtsProvider } from "./types";

export type RunNarrateArgs = {
  storyboard: Storyboard;
  config: ProductConfig;
  provider: TtsProvider;
  audioDir: string; // absolute dir to write audio into
  productDir: string; // absolute product root (manifest paths are relative to this)
};

export async function runNarrate(args: RunNarrateArgs): Promise<AudioManifest> {
  const { storyboard, config, provider, audioDir, productDir } = args;
  await mkdir(audioDir, { recursive: true });

  const scenes: AudioSceneEntry[] = [];
  for (const scene of storyboard.scenes) {
    const hash = hashValue({ narration: scene.narration ?? null, duration: scene.duration });

    if (!scene.narration) {
      const finalSec = resolveFinalSec(scene, null, storyboard.defaults);
      scenes.push({ id: scene.id, audio: null, audioSec: null, finalSec, hash });
      continue;
    }

    const outPath = join(audioDir, `${scene.id}.mp3`);
    const { durationSec } = await provider.synthesize({ text: scene.narration, outPath, config });
    const finalSec = resolveFinalSec(scene, durationSec, storyboard.defaults);
    scenes.push({ id: scene.id, audio: relative(productDir, outPath), audioSec: durationSec, finalSec, hash });
  }

  return { scenes };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd video-studio && bun test engine/narrate/narrate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add video-studio/engine/narrate/types.ts video-studio/engine/narrate/narrate.ts video-studio/engine/narrate/narrate.test.ts
git commit -m "video-studio: narrate stage logic with fake-provider tests"
```

---

## Task 10: Real ElevenLabs provider

**Files:**
- Create: `video-studio/engine/narrate/elevenlabs.ts`
- Test: `video-studio/engine/narrate/elevenlabs.test.ts`

- [ ] **Step 1: Write the failing test (mocks `fetch`)**

`video-studio/engine/narrate/elevenlabs.test.ts`:

```ts
import { test, expect, mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createElevenLabsProvider } from "./elevenlabs";
import type { ProductConfig } from "../schema";

const config: ProductConfig = {
  appUrl: "http://localhost:1",
  theme: { palette: { bg: "#000", fg: "#fff", accent: "#f00" }, fonts: { heading: "A", body: "A" }, direction: "ltr" },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "voice-1" },
};

test("writes audio and returns the last alignment end time as duration", async () => {
  const audioB64 = Buffer.from("FAKEAUDIO").toString("base64");
  const fakeFetch = mock(async () =>
    new Response(
      JSON.stringify({ audio_base64: audioB64, alignment: { character_end_times_seconds: [0.5, 1.0, 4.2] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const provider = createElevenLabsProvider({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
  const dir = mkdtempSync(join(tmpdir(), "vs-el-"));
  const outPath = join(dir, "s.mp3");
  const r = await provider.synthesize({ text: "Hello", outPath, config });
  expect(r.durationSec).toBeCloseTo(4.2);
  expect((await Bun.file(outPath).arrayBuffer()).byteLength).toBe(9);
});

test("throws a clear error when the API key is missing", () => {
  expect(() => createElevenLabsProvider({ apiKey: "" })).toThrow(/ELEVENLABS_API_KEY/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/narrate/elevenlabs.test.ts`
Expected: FAIL — `Cannot find module './elevenlabs'`.

- [ ] **Step 3: Write `video-studio/engine/narrate/elevenlabs.ts`**

```ts
import type { TtsProvider, TtsRequest, TtsResult } from "./types";

export type ElevenLabsOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  defaultModelId?: string;
};

type WithTimestampsResponse = {
  audio_base64: string;
  alignment: { character_end_times_seconds: number[] };
};

/** Concrete ElevenLabs TTS provider using the with-timestamps endpoint for exact duration. */
export function createElevenLabsProvider(opts: ElevenLabsOptions): TtsProvider {
  if (!opts.apiKey) {
    throw new Error("ElevenLabs API key missing — set ELEVENLABS_API_KEY in the environment");
  }
  const doFetch = opts.fetchImpl ?? fetch;
  const defaultModel = opts.defaultModelId ?? "eleven_multilingual_v2";

  return {
    async synthesize(req: TtsRequest): Promise<TtsResult> {
      const voice = req.config.voice;
      if (!voice) throw new Error("product config has no `voice` — set voice.id to an ElevenLabs voice id");

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "xi-api-key": opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ text: req.text, model_id: voice.modelId ?? defaultModel, output_format: "mp3_44100_128" }),
      });
      if (!res.ok) {
        throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as WithTimestampsResponse;
      const bytes = Buffer.from(data.audio_base64, "base64");
      await Bun.write(req.outPath, bytes);

      const ends = data.alignment.character_end_times_seconds;
      const durationSec = ends.length ? ends[ends.length - 1]! : 0;
      return { durationSec };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/narrate/elevenlabs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add video-studio/engine/narrate/elevenlabs.ts video-studio/engine/narrate/elevenlabs.test.ts
git commit -m "video-studio: ElevenLabs TTS provider via with-timestamps"
```

---

## Task 11: Render schedule (pure) + Remotion components

**Files:**
- Create: `video-studio/engine/render/schedule.ts`
- Create: `video-studio/engine/render/theme.tsx`
- Create: `video-studio/engine/render/components/Caption.tsx`
- Create: `video-studio/engine/render/components/KenBurns.tsx`
- Create: `video-studio/engine/render/components/TitleCard.tsx`
- Create: `video-studio/engine/render/Video.tsx`
- Create: `video-studio/engine/render/Root.tsx`
- Create: `video-studio/engine/index.ts`
- Create: `video-studio/remotion.config.ts`
- Test: `video-studio/engine/render/schedule.test.ts`

- [ ] **Step 1: Write the failing test for the pure scheduler**

`video-studio/engine/render/schedule.test.ts`:

```ts
import { test, expect } from "bun:test";
import { computeSchedule } from "./schedule";
import type { Storyboard } from "../schema";
import type { CaptureManifest, AudioManifest } from "../manifest";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard" }, caption: { primary: "Hi" }, narration: "x", duration: "auto", transitionOut: "fade" },
    { id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2, motion: "kenburns", transitionOut: "cut" },
  ],
};
const capture: CaptureManifest = {
  scenes: [
    { id: "01-title", kind: "titlecard", asset: "assets/01-title.png", ok: true, hash: "a" },
    { id: "02-home", kind: "screenshot", asset: "assets/02-home.png", ok: true, hash: "b" },
  ],
};
const audio: AudioManifest = {
  scenes: [
    { id: "01-title", audio: "audio/01-title.mp3", audioSec: 3, finalSec: 3, hash: "a" },
    { id: "02-home", audio: null, audioSec: null, finalSec: 2, hash: "b" },
  ],
};

test("computes cumulative frame timing at the given fps", () => {
  const sched = computeSchedule(storyboard, capture, audio, 30);
  expect(sched[0]!.durationInFrames).toBe(90);
  expect(sched[1]!.durationInFrames).toBe(60);
  expect(sched[0]!.fromFrame).toBe(0);
  expect(sched[1]!.fromFrame).toBe(90);
  expect(sched[0]!.audio).toBe("audio/01-title.mp3");
  expect(sched[1]!.audio).toBeNull();
});

test("throws naming the scene when a capture entry is missing", () => {
  const bad: CaptureManifest = { scenes: [capture.scenes[0]!] };
  expect(() => computeSchedule(storyboard, bad, audio, 30)).toThrow(/02-home/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/render/schedule.test.ts`
Expected: FAIL — `Cannot find module './schedule'`.

- [ ] **Step 3: Write `video-studio/engine/render/schedule.ts`**

```ts
import type { LocalizedText } from "../schema";
import type { Storyboard, Scene } from "../schema";
import type { AudioManifest, CaptureManifest } from "../manifest";

export type ScheduledScene = {
  id: string;
  kind: "screenshot" | "interaction" | "titlecard";
  asset: string;
  audio: string | null;
  fromFrame: number;
  durationInFrames: number;
  caption?: { primary: string; secondary?: string };
  motion: "kenburns" | "none";
  transitionOut: "cut" | "fade" | "slide";
};

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function computeSchedule(
  storyboard: Storyboard,
  capture: CaptureManifest,
  audio: AudioManifest,
  fps: number,
): ScheduledScene[] {
  const caps = byId(capture.scenes);
  const auds = byId(audio.scenes);
  const defaultMotion = storyboard.defaults?.motion ?? "none";
  const defaultTransition = storyboard.defaults?.transitionOut ?? "cut";

  const out: ScheduledScene[] = [];
  let cursor = 0;
  for (const scene of storyboard.scenes) {
    const cap = caps.get(scene.id);
    const aud = auds.get(scene.id);
    if (!cap) throw new Error(`render: no capture manifest entry for scene "${scene.id}" — run capture first`);
    if (!aud) throw new Error(`render: no audio manifest entry for scene "${scene.id}" — run narrate first`);

    const durationInFrames = Math.max(1, Math.round(aud.finalSec * fps));
    out.push({
      id: scene.id,
      kind: cap.kind,
      asset: cap.asset,
      audio: aud.audio,
      fromFrame: cursor,
      durationInFrames,
      caption: scene.caption as LocalizedText | undefined,
      motion: scene.motion ?? defaultMotion,
      transitionOut: scene.transitionOut ?? defaultTransition,
    });
    cursor += durationInFrames;
  }
  return out;
}

export function totalFrames(schedule: ScheduledScene[]): number {
  return schedule.reduce((sum, s) => sum + s.durationInFrames, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/render/schedule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `video-studio/engine/render/theme.tsx`**

```tsx
import React, { createContext, useContext } from "react";
import type { ProductConfigData } from "../schema";

export type Theme = ProductConfigData["theme"];
export type Locale = ProductConfigData["locale"];

const ThemeContext = createContext<{ theme: Theme; locale: Locale } | null>(null);

export const ThemeProvider: React.FC<{ theme: Theme; locale: Locale; children: React.ReactNode }> = ({ theme, locale, children }) => (
  <ThemeContext.Provider value={{ theme, locale }}>{children}</ThemeContext.Provider>
);

export function useTheme(): { theme: Theme; locale: Locale } {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
```

- [ ] **Step 6: Write `video-studio/engine/render/components/Caption.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "../theme";

export const Caption: React.FC<{ primary: string; secondary?: string }> = ({ primary, secondary }) => {
  const { theme } = useTheme();
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const align = theme.direction === "rtl" ? "flex-end" : "flex-start";

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: align, padding: 80, opacity }}>
      <div style={{ direction: theme.direction, textAlign: theme.direction === "rtl" ? "right" : "left" }}>
        <div style={{ color: theme.palette.fg, fontFamily: theme.fonts.heading, fontSize: 64, fontWeight: 700 }}>{primary}</div>
        {secondary ? (
          <div style={{ color: theme.palette.accent, fontFamily: theme.fonts.body, fontSize: 36, marginTop: 8 }}>{secondary}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 7: Write `video-studio/engine/render/components/KenBurns.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";

export const KenBurns: React.FC<{ src: string; enabled: boolean }> = ({ src, enabled }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = enabled ? interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: "clamp" }) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 8: Write `video-studio/engine/render/components/TitleCard.tsx`**

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from "../theme";

export const TitleCard: React.FC = () => {
  const { theme } = useTheme();
  return <AbsoluteFill style={{ background: theme.palette.bg }} />;
};
```

- [ ] **Step 9: Write `video-studio/engine/render/Video.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { ProductConfigData } from "../schema";
import type { ScheduledScene } from "./schedule";
import { ThemeProvider } from "./theme";
import { Caption } from "./components/Caption";
import { KenBurns } from "./components/KenBurns";
import { TitleCard } from "./components/TitleCard";

const TRANSITION_FRAMES = 15;

export type VideoProps = {
  schedule: ScheduledScene[];
  theme: ProductConfigData["theme"];
  locale: ProductConfigData["locale"];
};

const SceneBody: React.FC<{ scene: ScheduledScene }> = ({ scene }) => (
  <AbsoluteFill>
    {scene.kind === "titlecard" ? (
      <TitleCard />
    ) : scene.kind === "interaction" ? (
      <OffthreadVideo src={staticFile(scene.asset)} />
    ) : (
      <KenBurns src={scene.asset} enabled={scene.motion === "kenburns"} />
    )}
    {scene.caption ? <Caption primary={scene.caption.primary} secondary={scene.caption.secondary} /> : null}
    {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
  </AbsoluteFill>
);

export const Video: React.FC<VideoProps> = ({ schedule, theme, locale }) => {
  return (
    <ThemeProvider theme={theme} locale={locale}>
      <AbsoluteFill style={{ background: theme.palette.bg }}>
        <TransitionSeries>
          {schedule.flatMap((scene, i) => {
            const seq = (
              <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
                <SceneBody scene={scene} />
              </TransitionSeries.Sequence>
            );
            const prev = schedule[i - 1];
            if (i === 0 || !prev || prev.transitionOut === "cut") return [seq];
            const presentation = prev.transitionOut === "slide" ? slide() : fade();
            return [
              <TransitionSeries.Transition key={`t-${scene.id}`} presentation={presentation} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />,
              seq,
            ];
          })}
        </TransitionSeries>
      </AbsoluteFill>
    </ThemeProvider>
  );
};

// Re-exported so the smoke test can import it.
export { Sequence };
```

- [ ] **Step 10: Write `video-studio/engine/render/Root.tsx`**

```tsx
import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { computeSchedule, totalFrames } from "./schedule";
import type { LoadedProduct } from "../config";
import type { CaptureManifest, AudioManifest } from "../manifest";

export type RenderInput = {
  product: LoadedProduct;
  capture: CaptureManifest;
  audio: AudioManifest;
};

/** Build a Root for a single product. The CLI injects the loaded product + manifests. */
export function makeRoot(input: RenderInput): React.FC {
  const { product, capture, audio } = input;
  const { config, storyboard } = product;
  const schedule = computeSchedule(storyboard, capture, audio, config.output.fps);
  const durationInFrames = Math.max(1, totalFrames(schedule));

  return () => (
    <Composition
      id="ProductVideo"
      component={Video as React.FC<Record<string, unknown>>}
      durationInFrames={durationInFrames}
      fps={config.output.fps}
      width={config.output.width}
      height={config.output.height}
      defaultProps={{ schedule, theme: config.theme, locale: config.locale }}
    />
  );
}
```

- [ ] **Step 11: Write `video-studio/engine/index.ts`**

```ts
// Studio/preview entry. The CLI render path builds its own Root via makeRoot();
// this entry reads VS_PRODUCT to let `remotion studio engine/index.ts` preview a product.
import { registerRoot } from "remotion";
import React from "react";
import { loadProduct } from "./config";
import { readCaptureManifest, readAudioManifest } from "./manifest";
import { makeRoot } from "./render/Root";

const root = import.meta.dir; // engine/
const studioRoot = root.replace(/\/engine$/, "");
const product = process.env.VS_PRODUCT ?? "demo";
const base = process.env.VS_BASE ?? (product === "demo" ? "fixtures" : "products");

const loaded = await loadProduct(studioRoot, product, base);
const capture = (await readCaptureManifest(loaded.paths.captureManifest)) ?? { scenes: [] };
const audio = (await readAudioManifest(loaded.paths.audioManifest)) ?? { scenes: [] };

registerRoot(makeRoot({ product: loaded, capture, audio }));
export {};
```

- [ ] **Step 12: Write `video-studio/remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 13: Typecheck the render layer**

Run: `cd video-studio && bunx tsc --noEmit`
Expected: no type errors across `engine/`. Fix any reported mismatches before committing.

- [ ] **Step 14: Commit**

```bash
git add video-studio/engine/render video-studio/engine/index.ts video-studio/remotion.config.ts
git commit -m "video-studio: render schedule + themed Remotion composition"
```

---

## Task 12: CLI orchestrator

**Files:**
- Create: `video-studio/engine/cli.ts`
- Create: `video-studio/engine/stages.ts`
- Test: `video-studio/engine/cli.test.ts`

- [ ] **Step 1: Write the failing test for argument parsing**

`video-studio/engine/cli.test.ts`:

```ts
import { test, expect } from "bun:test";
import { parseArgs, stagesToRun, ALL_STAGES } from "./stages";

test("parses product name and defaults to all stages", () => {
  const a = parseArgs(["manasik"]);
  expect(a.product).toBe("manasik");
  expect(stagesToRun(a)).toEqual(ALL_STAGES);
});

test("--only restricts to one stage", () => {
  expect(stagesToRun(parseArgs(["manasik", "--only", "capture"]))).toEqual(["capture"]);
});

test("--from runs that stage onward", () => {
  expect(stagesToRun(parseArgs(["manasik", "--from", "narrate"]))).toEqual(["narrate", "render"]);
});

test("--force and --preview flags are parsed", () => {
  const a = parseArgs(["manasik", "--force", "--preview"]);
  expect(a.force).toBe(true);
  expect(a.preview).toBe(true);
});

test("init subcommand is recognized", () => {
  expect(parseArgs(["init", "newproduct"]).command).toBe("init");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video-studio && bun test engine/cli.test.ts`
Expected: FAIL — `Cannot find module './stages'`.

- [ ] **Step 3: Write `video-studio/engine/stages.ts`**

```ts
export const ALL_STAGES = ["capture", "narrate", "render"] as const;
export type Stage = (typeof ALL_STAGES)[number];

export type ParsedArgs = {
  command: "run" | "init";
  product: string;
  only?: Stage;
  from?: Stage;
  force: boolean;
  preview: boolean;
  base: string;
};

function isStage(s: string | undefined): s is Stage {
  return !!s && (ALL_STAGES as readonly string[]).includes(s);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  let command: "run" | "init" = "run";
  if (args[0] === "init") {
    command = "init";
    args.shift();
  }
  const product = args.shift() ?? "";

  const out: ParsedArgs = { command, product, force: false, preview: false, base: "products" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--only" && isStage(args[i + 1])) out.only = args[++i] as Stage;
    else if (a === "--from" && isStage(args[i + 1])) out.from = args[++i] as Stage;
    else if (a === "--force") out.force = true;
    else if (a === "--preview") out.preview = true;
    else if (a === "--base" && args[i + 1]) out.base = args[++i]!;
  }
  return out;
}

export function stagesToRun(a: ParsedArgs): Stage[] {
  if (a.only) return [a.only];
  if (a.from) {
    const start = ALL_STAGES.indexOf(a.from);
    return ALL_STAGES.slice(start) as Stage[];
  }
  return [...ALL_STAGES];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video-studio && bun test engine/cli.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write `video-studio/engine/cli.ts`**

```ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadProduct } from "./config";
import { readAudioManifest, readCaptureManifest, writeAudioManifest, writeCaptureManifest } from "./manifest";
import { runCapture } from "./capture/capture";
import { createPlaywrightDriver } from "./capture/playwright-driver";
import { runNarrate } from "./narrate/narrate";
import { createElevenLabsProvider } from "./narrate/elevenlabs";
import { parseArgs, stagesToRun } from "./stages";

const ROOT = import.meta.dir.replace(/\/engine$/, "");

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  if (!args.product) {
    console.error("usage: video <product> [--only capture|narrate|render] [--from <stage>] [--force] [--preview]\n       video init <product>");
    process.exit(1);
  }

  if (args.command === "init") {
    await scaffold(args.product);
    return;
  }

  const product = await loadProduct(ROOT, args.product, args.base);
  const stages = stagesToRun(args);
  console.log(`▶ ${args.product}: ${stages.join(" → ")}`);

  if (stages.includes("capture")) {
    console.log("• capture");
    const m = await runCapture({
      storyboard: product.storyboard,
      config: product.config,
      driver: createPlaywrightDriver(),
      assetsDir: product.paths.assets,
      productDir: product.paths.dir,
    });
    await writeCaptureManifest(product.paths.captureManifest, m);
    const failed = m.scenes.filter((s) => !s.ok).map((s) => s.id);
    if (failed.length) throw new Error(`capture failed for: ${failed.join(", ")}`);
  }

  if (stages.includes("narrate")) {
    console.log("• narrate");
    const provider = createElevenLabsProvider({ apiKey: process.env.ELEVENLABS_API_KEY ?? "" });
    const m = await runNarrate({
      storyboard: product.storyboard,
      config: product.config,
      provider,
      audioDir: product.paths.audio,
      productDir: product.paths.dir,
    });
    await writeAudioManifest(product.paths.audioManifest, m);
  }

  if (stages.includes("render")) {
    console.log("• render");
    const capture = await readCaptureManifest(product.paths.captureManifest);
    const audio = await readAudioManifest(product.paths.audioManifest);
    if (!capture) throw new Error("no capture.json — run capture first");
    if (!audio) throw new Error("no audio.json — run narrate first");

    await mkdir(product.paths.out, { recursive: true });
    const serveUrl = await bundle({
      entryPoint: join(ROOT, "engine", "index.ts"),
      onProgress: () => {},
      // make staticFile() resolve assets/audio relative to the product dir
      publicDir: product.paths.dir,
    });
    process.env.VS_PRODUCT = args.product;
    process.env.VS_BASE = args.base;
    const composition = await selectComposition({ serveUrl, id: "ProductVideo" });
    const outPath = join(product.paths.out, `${args.product}.mp4`);
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: outPath });
    console.log(`✓ rendered ${outPath}`);
  }
}

async function scaffold(name: string) {
  const dir = join(ROOT, "products", name);
  await mkdir(dir, { recursive: true });
  const config = `import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:3000",
  theme: {
    palette: { bg: "#0d110d", fg: "#ffffff", accent: "#c8a45c" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "REPLACE_WITH_ELEVENLABS_VOICE_ID" },
};

export default config;
`;
  const storyboard = `import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard" }, caption: { primary: "${name}" }, narration: "Welcome to ${name}.", duration: "auto", transitionOut: "fade" },
  ],
};

export default storyboard;
`;
  await Bun.write(join(dir, "product.config.ts"), config);
  await Bun.write(join(dir, "storyboard.ts"), storyboard);
  console.log(`✓ scaffolded products/${name}/ (edit product.config.ts + storyboard.ts, then: bun run video ${name})`);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
```

- [ ] **Step 6: Verify `init` scaffolds a working product**

Run: `cd video-studio && bun run video init smoke && bunx tsc --noEmit`
Expected: prints "scaffolded products/smoke/", and typecheck passes. Then clean up: `rm -rf products/smoke`.

- [ ] **Step 7: Commit**

```bash
git add video-studio/engine/cli.ts video-studio/engine/stages.ts video-studio/engine/cli.test.ts
git commit -m "video-studio: CLI orchestrator + init scaffolder"
```

---

## Task 13: End-to-end smoke render

**Files:**
- Create: `video-studio/engine/e2e.test.ts`

- [ ] **Step 1: Write the end-to-end smoke test**

This test serves the static fixture, runs `capture` with the real Playwright driver, runs `narrate` with a fake provider (no network), writes both manifests, then renders a few frames with Remotion to prove the whole wiring.

`video-studio/engine/e2e.test.ts`:

```ts
import { test, expect, afterAll } from "bun:test";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { loadProduct } from "./config";
import { runCapture } from "./capture/capture";
import { createPlaywrightDriver } from "./capture/playwright-driver";
import { runNarrate } from "./narrate/narrate";
import { writeCaptureManifest, writeAudioManifest, readCaptureManifest, readAudioManifest } from "./manifest";
import type { TtsProvider } from "./narrate/types";

const ROOT = join(import.meta.dir, "..");

const server = Bun.serve({
  port: 4599,
  fetch: () => new Response(Bun.file(join(ROOT, "fixtures/static-app/index.html")), { headers: { "content-type": "text/html" } }),
});
afterAll(() => server.stop(true));

const fakeTts: TtsProvider = { synthesize: async () => ({ durationSec: 1.5 }) };

test("captures → narrates → renders the demo fixture to an mp4", async () => {
  const product = await loadProduct(ROOT, "demo", "fixtures");

  const cap = await runCapture({
    storyboard: product.storyboard,
    config: product.config,
    driver: createPlaywrightDriver(),
    assetsDir: product.paths.assets,
    productDir: product.paths.dir,
  });
  await writeCaptureManifest(product.paths.captureManifest, cap);
  expect(cap.scenes.every((s) => s.ok)).toBe(true);

  const aud = await runNarrate({
    storyboard: product.storyboard,
    config: product.config,
    provider: fakeTts,
    audioDir: product.paths.audio,
    productDir: product.paths.dir,
  });
  await writeAudioManifest(product.paths.audioManifest, aud);

  expect(await readCaptureManifest(product.paths.captureManifest)).not.toBeNull();
  expect(await readAudioManifest(product.paths.audioManifest)).not.toBeNull();

  process.env.VS_PRODUCT = "demo";
  process.env.VS_BASE = "fixtures";
  const serveUrl = await bundle({ entryPoint: join(ROOT, "engine", "index.ts"), publicDir: product.paths.dir, onProgress: () => {} });
  const composition = await selectComposition({ serveUrl, id: "ProductVideo" });
  const outPath = join(product.paths.out, "demo.mp4");
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: outPath, frameRange: [0, 20] });

  expect((await Bun.file(outPath).arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 180_000);
```

- [ ] **Step 2: Run the smoke test**

Run: `cd video-studio && bun test engine/e2e.test.ts`
Expected: PASS (1 test). Produces `fixtures/demo/out/demo.mp4`. If Chromium is missing, run `bunx playwright install chromium`.

- [ ] **Step 3: Run the whole unit suite**

Run: `cd video-studio && bun test`
Expected: all tests green.

- [ ] **Step 4: Commit**

```bash
git add video-studio/engine/e2e.test.ts
git commit -m "video-studio: end-to-end capture→narrate→render smoke test"
```

---

## Task 14: Port the Manasik storyboard

**Files:**
- Create: `video-studio/products/manasik/product.config.ts`
- Create: `video-studio/products/manasik/storyboard.ts`
- Create: `video-studio/README.md`

- [ ] **Step 1: Create `video-studio/products/manasik/product.config.ts`**

Port the theme/locale from the existing `manasik-demo/demo-video-assets-design.md` spec (dark `#0d110d` background, Arabic RTL, 1920×1080, 30 fps). The app runs from `~/Documents/GitHub/event-management` per the spec's pipeline note.

```ts
import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:3000",
  theme: {
    palette: { bg: "#0d110d", fg: "#ffffff", accent: "#c8a45c" },
    fonts: { heading: "Tajawal", body: "Tajawal" },
    direction: "rtl",
    logo: "assets/logo.svg",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "ar", secondary: "en" },
  voice: { id: "REPLACE_WITH_ELEVENLABS_VOICE_ID" },

  // Prime dark + Arabic + most-permissive role before first paint (per the spec).
  prime: async (page) => {
    await (page as { addInitScript: (fn: () => void) => Promise<void> }).addInitScript(() => {
      localStorage.setItem("theme", "dark");
      localStorage.setItem("locale", "ar");
    });
  },

  // Scene 5 needs a concrete guest id; resolve [firstId] here.
  resolveRoute: (route) => route.replace("[firstId]", "g-1"),
};

export default config;
```

- [ ] **Step 2: Create `video-studio/products/manasik/storyboard.ts`**

Port all 12 scenes from the spec's shot-list table (routes, durations, Arabic captions, English narration hooks). Title card is a generated card; the rest are screenshots with Ken-Burns.

```ts
import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  defaults: { motion: "kenburns", transitionOut: "fade" },
  scenes: [
    { id: "01-title", capture: { kind: "titlecard", logo: true }, caption: { primary: "مناسك", secondary: "Manasik" }, narration: "Manasik — Hajj VIP operations, unified.", duration: 3 },
    { id: "02-role-select", capture: { kind: "screenshot", route: "/" }, caption: { primary: "مصمَّم لكل دور في العملية", secondary: "Built for every role on the ground." }, narration: "Built for every role on the ground.", duration: 4 },
    { id: "03-dashboard", capture: { kind: "screenshot", route: "/dashboard" }, caption: { primary: "عرض واحد لكل الرحلة", secondary: "One live view of the entire journey." }, narration: "One live view of the entire journey.", duration: 8 },
    { id: "04-movement", capture: { kind: "screenshot", route: "/movement" }, caption: { primary: "من المطار إلى عرفات", secondary: "From the airport to Arafat — every stage tracked." }, narration: "From the airport to Arafat — every stage tracked.", duration: 8 },
    { id: "05-guest", capture: { kind: "screenshot", route: "/guests/[firstId]" }, caption: { primary: "كل ضيف، كل تفصيل", secondary: "Every guest, every touchpoint, in one profile." }, narration: "Every guest, every touchpoint, in one profile.", duration: 6 },
    { id: "06-convoys", capture: { kind: "screenshot", route: "/convoy-control" }, caption: { primary: "تنسيق القوافل لحظة بلحظة", secondary: "Coordinate convoys in real time." }, narration: "Coordinate convoys in real time.", duration: 6 },
    { id: "07-flights", capture: { kind: "screenshot", route: "/flights" }, caption: { primary: "الوصول والمغادرة بنظرة", secondary: "Arrivals and departures at a glance." }, narration: "Arrivals and departures at a glance.", duration: 5 },
    { id: "08-accommodation", capture: { kind: "screenshot", route: "/accommodation" }, caption: { primary: "الغرف والقاعات والطاقة", secondary: "Rooms, halls, capacity — always current." }, narration: "Rooms, halls, capacity — always current.", duration: 5 },
    { id: "09-communications", capture: { kind: "screenshot", route: "/communications" }, caption: { primary: "تواصل فوري مع الضيوف", secondary: "Reach any guest instantly." }, narration: "Reach any guest instantly.", duration: 6 },
    { id: "10-emergency", capture: { kind: "screenshot", route: "/emergency" }, caption: { primary: "استجابة منسّقة للحوادث", secondary: "Incident response, coordinated." }, narration: "Incident response, coordinated.", duration: 5 },
    { id: "11-scan", capture: { kind: "screenshot", route: "/scan" }, caption: { primary: "تسجيل دخول بلمسة", secondary: "Check in with a tap." }, narration: "Check in with a tap.", duration: 4 },
    { id: "12-reports", capture: { kind: "screenshot", route: "/reports" }, caption: { primary: "قرارات مبنية على البيانات", secondary: "Decisions backed by data." }, narration: "Decisions backed by data.", duration: 6, transitionOut: "cut" },
  ],
};

export default storyboard;
```

- [ ] **Step 3: Verify the Manasik product validates**

Run: `cd video-studio && bun run -e 'import { loadProduct } from "./engine/config"; const p = await loadProduct(process.cwd(), "manasik"); console.log("scenes:", p.storyboard.scenes.length)'`
Expected: prints `scenes: 12` with no validation error.

- [ ] **Step 4: Write `video-studio/README.md`**

````markdown
# Video Studio

Turn any running web app into a narrated demo video. A product-agnostic engine plus one
config folder per product.

## Onboard a product

```bash
cd video-studio
bun install
bunx playwright install chromium       # one time
bun run video init <name>              # scaffolds products/<name>/
# edit products/<name>/product.config.ts and storyboard.ts
export ELEVENLABS_API_KEY=...          # required for the narrate stage
bun run video <name>                   # capture → narrate → render
```

## Stages

- `bun run video <name> --only capture`  — Playwright screenshots/clips → `manifests/capture.json`
- `bun run video <name> --only narrate`  — ElevenLabs TTS → `manifests/audio.json`
- `bun run video <name> --only render`   — Remotion → `out/<name>.mp4` (offline; no browser/network)
- `--from <stage>` runs that stage onward; `--force` ignores caches.

`render` consumes only the manifests, so iterate on timing/captions without re-capturing.
Preview live: `VS_PRODUCT=<name> bun run preview`.

## Layout

- `engine/` — shared pipeline. Never edit it to onboard a product.
- `products/<name>/` — `product.config.ts` (app URL, theme, locale, voice) + `storyboard.ts` (scenes).
````

- [ ] **Step 5: Commit**

```bash
git add video-studio/products/manasik video-studio/README.md
git commit -m "video-studio: port Manasik storyboard + add README"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** capture (Task 7, 8) ✓; narrate + ElevenLabs + auto-durations (Task 9, 10, 5) ✓; render + transitions + theming + captions (Task 11) ✓; manifests-as-interface + resumability hashes (Task 4, and `hash` fields written by capture/narrate) ✓; CLI `--only/--from/--force/init` (Task 12) ✓; error handling — Zod paths, redirect + min-size guards, missing-manifest hard errors, missing-key message (Tasks 1, 7, 10, 11, 12) ✓; testing with fakes + e2e smoke (Tasks 7, 9, 13) ✓; standalone packaging + products-as-config + Manasik port (Tasks 0, 14) ✓.
- **Deferred per spec:** background music (not implemented); auto-discovery (seams only — the pipeline consumes a `Storyboard` object, so a future generator drops in).
- **Resumability note:** manifests store per-scene `hash`; the `--force` flag and cache-skip optimization can be layered on by comparing stored vs current `hash` before re-running a scene. The MVP recomputes every scene each run; skipping unchanged scenes is a safe follow-up that does not change the manifest shape.
- **Type consistency check:** `PageDriver`, `TtsProvider`, `CaptureManifest`, `AudioManifest`, `ScheduledScene`, `ProductConfig`, `Storyboard` names are used identically across tasks.
```
````
