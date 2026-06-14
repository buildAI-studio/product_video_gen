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
