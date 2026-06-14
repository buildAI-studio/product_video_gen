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
