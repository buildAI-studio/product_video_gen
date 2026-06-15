import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { runCapture } from "./capture";
import type { PageDriver, ScreenshotRequest } from "./types";
import type { Storyboard, ProductConfig, Step } from "../schema";
import { parseStoryboard } from "../schema";

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

test("caching: fully-cached run never calls health() even if the server is down", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-lazy-health-"));

  // First run: real driver that writes files so the on-disk existence check passes later
  const firstDriver = fakeDriver({
    screenshot: async (req) => {
      await Bun.write(req.outPath, "x".repeat(50_000));
      return { bytes: 50_000, w: 1920, h: 1080 };
    },
    clip: async (req) => {
      await Bun.write(req.outPath, "x".repeat(200_000));
      return { bytes: 200_000, w: 1920, h: 1080 };
    },
  });
  const prior = await runCapture({ storyboard, config, driver: firstDriver, assetsDir: dir, productDir: dir });
  expect(prior.scenes.every((s) => s.ok)).toBe(true);

  // Second run: driver whose health() and capture methods throw — all scenes must be cache hits
  const deadDriver = fakeDriver({
    health: async () => { throw new Error("server down"); },
    screenshot: async () => { throw new Error("server down"); },
    clip: async () => { throw new Error("server down"); },
  });
  const m2 = await runCapture({ storyboard, config, driver: deadDriver, assetsDir: dir, productDir: dir, prior, force: false });

  // Must resolve successfully (health was never called) and return the same manifest
  expect(m2.scenes.map((s) => s.id)).toEqual(prior.scenes.map((s) => s.id));
  expect(m2.scenes.every((s) => s.ok)).toBe(true);
});

test("screenshot scene with steps passes them into driver.screenshot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-steps-"));
  const capturedReqs: ScreenshotRequest[] = [];
  const steps: Step[] = [{ action: "click", selector: "#b" }];
  const sb: Storyboard = {
    scenes: [{ id: "x", capture: { kind: "screenshot", route: "/", steps }, duration: 2 }],
  };
  await runCapture({
    storyboard: sb,
    config,
    assetsDir: dir,
    productDir: dir,
    driver: fakeDriver({
      screenshot: async (req) => {
        capturedReqs.push(req);
        return { bytes: 50_000, w: 1920, h: 1080 };
      },
    }),
  });
  expect(capturedReqs).toHaveLength(1);
  expect(capturedReqs[0]!.steps).toEqual(steps);
});

test("parseStoryboard accepts screenshot with steps", () => {
  const parsed = parseStoryboard({
    scenes: [
      {
        id: "x",
        capture: { kind: "screenshot", route: "/", steps: [{ action: "click", selector: "#b" }] },
        duration: 2,
      },
    ],
  });
  expect(parsed.scenes[0]!.capture.kind).toBe("screenshot");
  // narrow to access steps
  const cap = parsed.scenes[0]!.capture;
  if (cap.kind === "screenshot") {
    expect(cap.steps).toEqual([{ action: "click", selector: "#b" }]);
  }
});

test("parseStoryboard accepts interaction capture with hover step", () => {
  const parsed = parseStoryboard({
    scenes: [
      {
        id: "x",
        capture: {
          kind: "interaction",
          route: "/",
          steps: [
            { action: "hover", selector: "#x" },
            { action: "click", selector: "#b" },
          ],
        },
        duration: 2,
      },
    ],
  });
  expect(parsed.scenes[0]!.capture.kind).toBe("interaction");
  const cap = parsed.scenes[0]!.capture;
  if (cap.kind === "interaction") {
    expect(cap.steps[0]).toEqual({ action: "hover", selector: "#x" });
    expect(cap.steps[1]).toEqual({ action: "click", selector: "#b" });
  }
});

test("focus: driver focus result is stored on manifest entry with label from scene", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-focus-"));
  const capturedReqs: ScreenshotRequest[] = [];
  const sb: Storyboard = {
    scenes: [{ id: "02-kpi", capture: { kind: "screenshot", route: "/dashboard" }, duration: 2, focus: { selector: "#kpi", label: "KPI" } }],
  };
  const m = await runCapture({
    storyboard: sb,
    config,
    assetsDir: dir,
    productDir: dir,
    driver: fakeDriver({
      screenshot: async (req) => {
        capturedReqs.push(req);
        return { bytes: 50_000, w: 1920, h: 1080, focus: { x: 100, y: 200, w: 300, h: 80 } };
      },
    }),
  });
  // focusSelector was passed to driver
  expect(capturedReqs[0]!.focusSelector).toBe("#kpi");
  // manifest entry has focus with measured box + label from scene
  expect(m.scenes[0]!.focus).toEqual({ x: 100, y: 200, w: 300, h: 80, label: "KPI" });
});

test("focus: no focus on manifest entry when driver returns no focus box", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-cap-focus-nil-"));
  const sb: Storyboard = {
    scenes: [{ id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2, focus: { selector: "#missing" } }],
  };
  const m = await runCapture({
    storyboard: sb,
    config,
    assetsDir: dir,
    productDir: dir,
    driver: fakeDriver({
      screenshot: async () => ({ bytes: 50_000, w: 1920, h: 1080 }),
    }),
  });
  expect(m.scenes[0]!.focus).toBeUndefined();
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
