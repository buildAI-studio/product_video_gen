import { test, expect, afterAll, beforeAll } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createPlaywrightDriver } from "./playwright-driver";
import type { ProductConfig } from "../schema";
import type { PageDriver } from "./types";

// Serve the static fixture so the driver has a real app to hit.
const server = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(Bun.file(join(import.meta.dir, "../../fixtures/static-app/index.html")), {
      headers: { "content-type": "text/html" },
    }),
});
const appUrl = `http://localhost:${server.port}`;

// Share one browser across all tests in this file to avoid Chromium launch overhead.
let driver: PageDriver;
beforeAll(() => { driver = createPlaywrightDriver(); });
afterAll(async () => {
  await driver.close();
  server.stop(true);
});

const config: ProductConfig = {
  appUrl,
  theme: {
    palette: { bg: "#0d110d", fg: "#fff", accent: "#f00" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 640, height: 360, fps: 30 },
  locale: { primary: "en" },
};

test(
  "screenshots a real served page above the min size",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "vs-pw-"));
    const outPath = join(dir, "home.png");
    await driver.health(config);
    const r = await driver.screenshot(
      { kind: "screenshot", route: appUrl + "/", outPath, capture: { kind: "screenshot", route: "/" } },
      config,
    );
    expect(r.bytes).toBeGreaterThan(8 * 1024);
  },
  120_000,
);

test(
  "screenshot runs pre-screenshot steps (click changes state before capture)",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "vs-pw-steps-"));
    const outPath = join(dir, "clicked.png");
    const r = await driver.screenshot(
      {
        kind: "screenshot",
        route: appUrl + "/",
        outPath,
        capture: { kind: "screenshot", route: "/", steps: [{ action: "click", selector: "#b" }] },
        steps: [{ action: "click", selector: "#b" }],
      },
      config,
    );
    expect(r.bytes).toBeGreaterThan(8 * 1024);
  },
  120_000,
);

test(
  "clip records a non-empty video after interaction steps",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "vs-pw-clip-"));
    const outPath = join(dir, "clip.mp4");
    const r = await driver.clip(
      {
        kind: "interaction",
        route: appUrl + "/",
        capture: {
          kind: "interaction",
          route: "/",
          steps: [
            { action: "click", selector: "#b" },
            { action: "wait", for: 300 },
          ],
        },
        outPath,
      },
      config,
    );
    expect(r.bytes).toBeGreaterThan(0);
  },
  120_000,
);

test(
  "clip records a non-empty video with hover + click steps (smooth motion + cursor)",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "vs-pw-clip-hover-"));
    const outPath = join(dir, "clip-hover.mp4");
    const r = await driver.clip(
      {
        kind: "interaction",
        route: appUrl + "/",
        capture: {
          kind: "interaction",
          route: "/",
          steps: [
            { action: "hover", selector: "#b" },
            { action: "wait", for: 300 },
            { action: "click", selector: "#b" },
          ],
        },
        outPath,
      },
      config,
    );
    expect(r.bytes).toBeGreaterThan(0);
  },
  120_000,
);
