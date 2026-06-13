import { test, expect, afterAll } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createPlaywrightDriver } from "./playwright-driver";
import type { ProductConfig } from "../schema";

// Serve the static fixture so the driver has a real app to hit.
const server = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(Bun.file(join(import.meta.dir, "../../fixtures/static-app/index.html")), {
      headers: { "content-type": "text/html" },
    }),
});
const appUrl = `http://localhost:${server.port}`;

afterAll(() => server.stop(true));

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
    const driver = createPlaywrightDriver();
    const dir = mkdtempSync(join(tmpdir(), "vs-pw-"));
    const outPath = join(dir, "home.png");
    await driver.health(config);
    const r = await driver.screenshot(
      { kind: "screenshot", route: appUrl + "/", outPath, capture: { kind: "screenshot", route: "/" } },
      config,
    );
    await driver.close();
    expect(r.bytes).toBeGreaterThan(8 * 1024);
  },
  60_000,
);
