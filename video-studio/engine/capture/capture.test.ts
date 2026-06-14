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

test("caching: second run skips driver calls when hash matches and asset exists on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-cache-"));
  let callCount = 0;
  const countingDriver = fakeDriver({
    screenshot: async (req) => {
      callCount++;
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
    clip: async (req) => {
      callCount++;
      await Bun.write(req.outPath, "x".repeat(200_000));
      return { bytes: 200_000, w: 1920, h: 1080 };
    },
  });

  // First run: no prior, all scenes captured
  const prior = await runCapture({ storyboard, config, driver: countingDriver, assetsDir: dir, productDir: dir });
  const callsAfterFirst = callCount;
  expect(callsAfterFirst).toBe(3); // titlecard (screenshot) + screenshot + clip

  // Second run: pass prior + force:false — should reuse all cached scenes
  const countingDriver2 = fakeDriver({
    screenshot: async (req) => {
      callCount++;
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
    clip: async (req) => {
      callCount++;
      await Bun.write(req.outPath, "x".repeat(200_000));
      return { bytes: 200_000, w: 1920, h: 1080 };
    },
  });
  const m2 = await runCapture({ storyboard, config, driver: countingDriver2, assetsDir: dir, productDir: dir, prior, force: false });
  expect(callCount).toBe(callsAfterFirst); // no new calls
  expect(m2.scenes.map((s) => s.id)).toEqual(prior.scenes.map((s) => s.id));
  expect(m2.scenes.every((s) => s.ok)).toBe(true);

  // Third run: force:true — should re-capture everything
  let forceCallCount = 0;
  const forceDriver = fakeDriver({
    screenshot: async (req) => {
      forceCallCount++;
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
    clip: async (req) => {
      forceCallCount++;
      await Bun.write(req.outPath, "x".repeat(200_000));
      return { bytes: 200_000, w: 1920, h: 1080 };
    },
  });
  await runCapture({ storyboard, config, driver: forceDriver, assetsDir: dir, productDir: dir, prior: m2, force: true });
  expect(forceCallCount).toBe(callsAfterFirst); // same count as first run
});

test("caching: skips only unchanged scenes, recaptures changed ones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-partial-"));
  const sb1: Storyboard = {
    scenes: [
      { id: "01-title", capture: { kind: "titlecard" }, duration: 2 },
      { id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2 },
    ],
  };
  let callCount = 0;
  const trackingDriver = fakeDriver({
    screenshot: async (req) => {
      callCount++;
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
  });
  const prior = await runCapture({ storyboard: sb1, config, driver: trackingDriver, assetsDir: dir, productDir: dir });
  const callsAfterFirst = callCount;

  // Change route of scene 02 — should recapture only that one
  const sb2: Storyboard = {
    scenes: [
      { id: "01-title", capture: { kind: "titlecard" }, duration: 2 }, // unchanged
      { id: "02-home", capture: { kind: "screenshot", route: "/changed" }, duration: 2 }, // changed route
    ],
  };
  let secondCallCount = 0;
  const trackingDriver2 = fakeDriver({
    screenshot: async (req) => {
      secondCallCount++;
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
  });
  await runCapture({ storyboard: sb2, config, driver: trackingDriver2, assetsDir: dir, productDir: dir, prior, force: false });
  // Only 02-home should be recaptured (01-title reused); titlecard doesn't go through screenshot path
  expect(secondCallCount).toBe(1);
});
