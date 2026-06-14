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
  prior?: CaptureManifest | null; // previous manifest for incremental caching
  force?: boolean; // when true, bypass cache and re-capture all scenes
};

function joinUrl(base: string, route: string): string {
  return base.replace(/\/$/, "") + (route.startsWith("/") ? route : `/${route}`);
}

export async function runCapture(args: RunCaptureArgs): Promise<CaptureManifest> {
  const { storyboard, config, driver, assetsDir, productDir, prior, force } = args;
  await mkdir(assetsDir, { recursive: true });

  // Build a lookup map from prior manifest for O(1) access
  const priorMap = new Map<string, CaptureSceneEntry>(prior?.scenes.map((s) => [s.id, s]) ?? []);

  const scenes: CaptureSceneEntry[] = [];
  let healthChecked = false;
  const ensureHealth = async () => {
    if (!healthChecked) {
      await driver.health(config);
      healthChecked = true;
    }
  };
  try {
    for (const scene of storyboard.scenes) {
      const cap = scene.capture;
      const ext = cap.kind === "interaction" ? "mp4" : "png";
      const outPath = join(assetsDir, `${scene.id}.${ext}`);
      const asset = relative(productDir, outPath);
      const hash = hashValue({ appUrl: config.appUrl, capture: cap });

      // Cache hit: reuse prior entry when hash matches, scene was ok, and file still exists
      if (!force) {
        const priorEntry = priorMap.get(scene.id);
        if (priorEntry && priorEntry.hash === hash && priorEntry.ok === true && (await Bun.file(outPath).exists())) {
          console.log(`↻ ${scene.id}: cached`);
          scenes.push(priorEntry);
          continue;
        }
      }

      try {
        let result: { bytes: number; w: number; h: number };
        if (cap.kind === "interaction") {
          const route = await resolveRoute(config, cap.route);
          await ensureHealth();
          result = await driver.clip({ kind: "interaction", route: joinUrl(config.appUrl, route), capture: cap, outPath }, config);
        } else if (cap.kind === "screenshot") {
          const route = await resolveRoute(config, cap.route);
          await ensureHealth();
          result = await driver.screenshot(
            { kind: "screenshot", route: joinUrl(config.appUrl, route), waitFor: cap.waitFor, steps: cap.steps, outPath, capture: cap },
            config,
          );
        } else {
          await ensureHealth();
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
