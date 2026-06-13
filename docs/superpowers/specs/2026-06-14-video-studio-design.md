# Video Studio — Design

**Date:** 2026-06-14
**Owner:** Emad
**Status:** Approved design, pending implementation plan

## Goal

Generalize the one-off Manasik demo-video work into a reusable toolkit that produces
polished product demo videos for many different products. A new product is onboarded by
authoring two config files and running one command — never by editing the engine. The
toolkit captures running web apps, generates voiceover, and renders with Remotion.

This spec covers the **config-driven core**. It is deliberately structured so an
**auto-discovery layer** (crawl a running app, propose a draft storyboard) can sit on top
later without reworking the engine.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scene discovery | Config-driven now; designed so auto-discovery can be added later |
| Capture type | Both, chosen per-scene: static screenshot (Ken-Burns) or scripted interaction clip |
| Audio | ElevenLabs TTS voiceover + on-screen captions; durations can auto-fit audio |
| Packaging | Standalone `video-studio` toolkit: one shared engine, each product is a config |
| Targets | Web apps reachable by URL (Playwright covers 100% of capture) |
| Stage wiring | Staged pipeline; JSON manifests are the interface between stages |
| Localization | `LocalizedText` with primary/secondary slots (e.g. ar primary + en secondary) |
| Interaction steps | `click`, `type`, `scroll`, `wait` (sufficient for v1) |
| Background music | Deferred to a later version |

## Non-goals (v1)

- No auto-discovery / crawling. Storyboards are hand-authored (the seam exists for later).
- No native mobile or desktop capture. Web apps only.
- No background music track (deferred; the render stage leaves room for it).
- No multi-language beyond primary/secondary caption slots + a single VO language per scene.
- No interaction steps beyond click/type/scroll/wait.

## Architecture

A standalone toolkit where the **engine is product-agnostic** and each **product is pure
config plus cached artifacts**. Three independent stages — `capture`, `narrate`, `render` —
communicate only through JSON manifests written to disk. `render` never touches a browser
or a TTS API; it consumes only files the prior stages produced. This is what makes stages
independently runnable, resumable, and testable, and what keeps `render` iteration (motion,
timing, captions) fast and offline.

```
video-studio/
  engine/                      # shared, knows nothing about any specific product
    schema.ts                  # Scene / Storyboard / Manifest types (Zod-validated)
    capture/
      app.ts                   #   boot + health-probe a running app, prime locale/theme/role
      screenshot.ts            #   Playwright → PNG (Ken-Burns source)
      interaction.ts           #   Playwright → recorded clip (scripted steps)
      titlecard.ts             #   generated inline-HTML card (no app route)
    narrate/
      provider.ts              #   TTS provider interface (pluggable)
      elevenlabs.ts            #   concrete ElevenLabs provider
    render/
      Root.tsx                 #   Remotion root; registers one composition per product
      Video.tsx                #   maps storyboard → <Sequence>s, transitions, captions, audio
      components/              #   Caption, TitleCard, KenBurns, LowerThird — themed
    cli.ts                     # orchestrator: video <product> [--only capture|narrate|render]

  products/
    manasik/
      product.config.ts        # app URL, theme tokens, locale, output (res/fps)
      storyboard.ts            # the scenes array — single source of truth
      assets/                  # captured PNGs + recorded clips   (git-ignored, cached)
      audio/                   # generated TTS clips              (git-ignored, cached)
      manifests/               # capture.json, audio.json         (git-ignored, cached)
      out/                     # final rendered mp4

  package.json                 # depends on remotion, @remotion/cli, playwright, zod,
                               # and an ElevenLabs client
```

**The onboarding contract:** to add a product you create `products/<name>/` with two
authored files — `product.config.ts` and `storyboard.ts` — and run one command. You never
touch `engine/`. That is the test of whether the generalization succeeded.

The existing `manasik-demo/` markdown specs become the first `products/manasik/` once the
storyboard is ported into the typed model.

## Data model

```ts
// engine/schema.ts  (Zod schemas + inferred TS types)

type LocalizedText = { primary: string; secondary?: string };

type Step =
  | { action: 'click';  selector: string }
  | { action: 'type';   selector: string; text: string }
  | { action: 'scroll'; selector?: string; to: 'bottom' | 'top' | number }
  | { action: 'wait';   for: string | number };   // selector or ms

type Capture =
  | { kind: 'screenshot';  route: string; waitFor?: string }
  | { kind: 'interaction'; route: string; steps: Step[]; waitFor?: string }
  | { kind: 'titlecard';   bg?: string; logo?: boolean };

type Scene = {
  id: string;                          // stable; names the cached asset (01-title.png ...)
  capture: Capture;
  caption?: LocalizedText;             // on-screen text overlay
  narration?: string;                  // TTS source (the spoken VO text)
  duration: number | 'auto';          // seconds; 'auto' = fit to this scene's TTS audio length
  motion?: 'kenburns' | 'none';        // screenshots only; ignored for clips
  transitionOut?: 'cut' | 'fade' | 'slide';
};

type Storyboard = {
  scenes: Scene[];
  defaults?: { transitionOut?: Scene['transitionOut']; motion?: Scene['motion']; duration?: number };
};
```

Decisions baked into the model:

- **`duration: 'auto'`** resolves during `narrate` (audio length + small padding) and is
  written into the manifest, so `render` always receives a concrete number. A scene with no
  narration must supply a numeric duration.
- **`id` is the cache key.** Stable ids mean re-running a stage overwrites the right artifact
  and nothing else; changing a caption never invalidates a screenshot.
- **Dynamic routes** (e.g. Manasik's `/guests/[firstId]`) are resolved by a hook in
  `product.config.ts` that the capture stage calls to substitute placeholders before
  navigating, keeping the storyboard declarative.
- **Validation is Zod**, so a malformed storyboard fails with a precise path
  (`scenes[4].capture.steps[1]`) before any browser launches.

## Stages and manifest contracts

The manifests *are* the interface between stages.

### Stage 1 — `capture` (`engine/capture/`)

- Boots/health-probes the app at `config.appUrl`; primes locale + theme + role via
  `addInitScript` (the Manasik dark + Arabic first-paint trick, now config-driven).
- Per scene, dispatches on `capture.kind`:
  - `screenshot` → PNG (1920×1080 viewport, `deviceScaleFactor: 2`, `document.fonts.ready`
    + settle).
  - `interaction` → executes `steps`, records a clip.
  - `titlecard` → generated HTML card via `page.setContent`, no app route.
- Resolves dynamic-route placeholders via the config hook.
- **Writes `manifests/capture.json`:**
  ```jsonc
  { "scenes": [ { "id": "05-guest", "kind": "screenshot",
                  "asset": "assets/05-guest.png", "ok": true, "w": 1920, "h": 1080 } ] }
  ```
- **Fails loudly:** redirect detection (role not primed), min-file-size guard (a blank page
  is ~5 KB), per-scene `waitFor`. Never silently ships a blank frame.

### Stage 2 — `narrate` (`engine/narrate/`)

- For each scene with `narration`, calls the ElevenLabs provider → audio clip, measures its
  real duration.
- Resolves every scene's final length: `'auto'` → audio length + padding; numeric →
  `max(audioLength, authored)` so VO is never cut off.
- **Writes `manifests/audio.json`:**
  ```jsonc
  { "scenes": [ { "id": "05-guest", "audio": "audio/05-guest.mp3",
                  "audioSec": 5.8, "finalSec": 6.0 } ] }
  ```
- Skippable: a product with no narration yields an empty audio manifest and `render` falls
  back to authored durations.
- TTS provider sits behind `provider.ts`; `elevenlabs.ts` is the concrete impl. Missing API
  key fails with a clear message, not a stack trace.

### Stage 3 — `render` (`engine/render/`)

- Pure Remotion. Imports the storyboard + both manifests, computes `durationInFrames` per
  scene from `finalSec × fps`, maps each scene to a `<Sequence>` with its asset (Ken-Burns
  `<Img>` or `<OffthreadVideo>` clip), themed `<Caption>`, scene audio, and the transition
  to its sibling.
- Touches no Playwright and no TTS — only files the prior stages produced. This is why
  motion/timing/caption iteration in the Remotion preview never re-captures.

### Resumability

A stage re-runs only the scenes whose inputs changed, detected by `id` + a hash of the
relevant storyboard slice stored in the manifest. `--force` redoes everything; `--only
<stage>` runs exactly one stage; `--from <stage>` runs that stage onward.

**Key property:** `render` depends on manifests, not on the world. `capture` and `narrate`
are the only stages that touch anything external, and they are isolated behind their JSON
outputs.

## Theming and per-product config

`product.config.ts` carries theme tokens the Remotion components read, so one engine renders
on-brand per product:

```ts
export default {
  appUrl: 'http://localhost:3000',
  theme: {
    palette: { bg: '#0d110d', fg: '#ffffff', accent: '#c8a45c' },
    fonts:   { heading: 'Tajawal', body: 'Tajawal' },
    direction: 'rtl',                 // 'rtl' | 'ltr' — drives caption alignment & slide dir
    logo: 'assets/logo.svg',
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: 'ar', secondary: 'en' },  // which LocalizedText slot is which
  // optional hooks:
  prime: (page) => { /* localStorage theme/locale/role before first paint */ },
  resolveRoute: (route) => route,     // substitute dynamic placeholders, e.g. [firstId]
};
```

Components (`Caption`, `TitleCard`, `LowerThird`) consume tokens via a small theme context —
no hardcoded colors or fonts in the engine. `direction` flips caption alignment and the
`slide` transition direction automatically.

## Orchestration CLI

Exposed as `bun run video` (`engine/cli.ts`):

```
video <product>                 # capture → narrate → render, end-to-end
video <product> --only capture  # one stage (also: narrate | render)
video <product> --from narrate  # this stage onward
video <product> --force         # ignore cache, redo everything
video <product> --preview       # launch Remotion Studio for live iteration
video init <product>            # scaffold a new products/<name>/ skeleton
```

`init` generates a minimal `product.config.ts` plus a one-scene `storyboard.ts` so a new
product starts from a working stub.

## Error handling

Fail loudly, fail early, never ship a bad frame:

- Storyboard validated by Zod before anything launches; errors cite the exact path.
- Capture: redirect detection, min-file-size guard, per-scene `waitFor` /
  `document.fonts.ready`; one scene failing fails that scene with a clear log, and
  `--only capture` retries just it.
- Narrate: TTS failures are per-scene and retried; a missing/invalid ElevenLabs key fails
  with a clear message.
- Render: a missing asset/audio referenced by a manifest is a hard error naming the scene
  `id`.

## Testing

The engine's pure parts are unit-tested without a browser:

- `schema` validation (good/bad storyboards), duration resolution (auto vs numeric vs
  max-with-audio), manifest read/write, dynamic-route substitution, frame-count math.
- Capture and narrate use **fakes** (a stub Playwright page, a stub TTS provider) so pipeline
  logic is tested without real browsers or API calls.
- One thin end-to-end smoke test renders a 2-scene fixture product (a tiny local static page)
  to a few frames via Remotion's `renderMedia`, proving the wiring.

## Verification (before marking the build complete)

1. `video init demo` scaffolds a buildable product stub.
2. Manasik storyboard ported into the typed model and validates under Zod.
3. `video manasik --only capture` produces all assets at the configured resolution, each
   above the min-file-size guard, with a complete `capture.json`.
4. `video manasik --only narrate` produces audio clips and an `audio.json` with resolved
   `finalSec` values.
5. `video manasik --only render` (offline) produces the final mp4 at the configured
   resolution/fps.
6. Re-running a stage without input changes is a near no-op (cache hit); `--force` redoes it.
7. Unit + smoke tests green.

## Future: auto-discovery (out of scope, seams only)

The config-driven core leaves these seams so a later auto-discovery layer can generate a
draft storyboard instead of hand-authoring it:

- The `Storyboard` is a plain typed object — anything that emits a valid one (a crawler, an
  LLM) feeds the same pipeline unchanged.
- Capture/narrate/render already consume a `Storyboard` + manifests, not authored files
  specifically, so a generated storyboard is a drop-in.
- A future `video discover <product>` command would crawl the running app, propose scenes,
  and write a `storyboard.ts` for the user to review and edit.
