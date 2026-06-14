import { test, expect, afterAll } from "bun:test";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { loadProduct } from "./config";
import { runCapture } from "./capture/capture";
import { createPlaywrightDriver } from "./capture/playwright-driver";
import { runNarrate } from "./narrate/narrate";
import { computeSchedule } from "./render/schedule";
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

  const capture = await readCaptureManifest(product.paths.captureManifest);
  const audio = await readAudioManifest(product.paths.audioManifest);
  expect(capture).not.toBeNull();
  expect(audio).not.toBeNull();

  const schedule = computeSchedule(product.storyboard, capture!, audio!, product.config.output.fps);
  const inputProps = {
    schedule,
    theme: product.config.theme,
    locale: product.config.locale,
    fps: product.config.output.fps,
    width: product.config.output.width,
    height: product.config.output.height,
  };

  const serveUrl = await bundle({ entryPoint: join(ROOT, "engine", "index.ts"), publicDir: product.paths.dir, onProgress: () => {} });
  const composition = await selectComposition({ serveUrl, id: "ProductVideo", inputProps });
  const outPath = join(product.paths.out, "demo.mp4");
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: outPath, inputProps, frameRange: [0, 20] });

  expect((await Bun.file(outPath).arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 180_000);
