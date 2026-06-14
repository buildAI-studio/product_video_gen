import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ProductConfig, Storyboard } from "../schema";
import { hashValue } from "../hash";
import { resolveFinalSec } from "../duration";
import type { AudioManifest, AudioSceneEntry } from "../manifest";
import type { TtsProvider } from "./types";

export type RunNarrateArgs = {
  storyboard: Storyboard;
  config: ProductConfig;
  provider: TtsProvider;
  audioDir: string; // absolute dir to write audio into
  productDir: string; // absolute product root (manifest paths are relative to this)
  prior?: AudioManifest | null; // previous manifest for incremental caching
  force?: boolean; // when true, bypass cache and re-synthesize all scenes
};

export async function runNarrate(args: RunNarrateArgs): Promise<AudioManifest> {
  const { storyboard, config, provider, audioDir, productDir, prior, force } = args;
  await mkdir(audioDir, { recursive: true });

  // Build a lookup map from prior manifest for O(1) access
  const priorMap = new Map<string, AudioSceneEntry>(prior?.scenes.map((s) => [s.id, s]) ?? []);

  const scenes: AudioSceneEntry[] = [];
  for (const scene of storyboard.scenes) {
    const hash = hashValue({ narration: scene.narration ?? null, duration: scene.duration });

    if (!scene.narration) {
      // Non-narrated scenes are free — no caching needed, just resolve duration
      const finalSec = resolveFinalSec(scene, null, storyboard.defaults);
      scenes.push({ id: scene.id, audio: null, audioSec: null, finalSec, hash });
      continue;
    }

    const outPath = join(audioDir, `${scene.id}.mp3`);

    // Cache hit: reuse prior entry when hash matches, audio exists, and file still on disk
    if (!force) {
      const priorEntry = priorMap.get(scene.id);
      if (priorEntry && priorEntry.hash === hash && priorEntry.audio !== null && priorEntry.audioSec !== null && (await Bun.file(outPath).exists())) {
        console.log(`↻ ${scene.id}: cached`);
        scenes.push(priorEntry);
        continue;
      }
    }

    const { durationSec } = await provider.synthesize({ text: scene.narration, outPath, config });
    const finalSec = resolveFinalSec(scene, durationSec, storyboard.defaults);
    scenes.push({ id: scene.id, audio: relative(productDir, outPath), audioSec: durationSec, finalSec, hash });
  }

  return { scenes };
}
