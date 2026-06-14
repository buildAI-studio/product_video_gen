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
