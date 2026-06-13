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
};

export async function runNarrate(args: RunNarrateArgs): Promise<AudioManifest> {
  const { storyboard, config, provider, audioDir, productDir } = args;
  await mkdir(audioDir, { recursive: true });

  const scenes: AudioSceneEntry[] = [];
  for (const scene of storyboard.scenes) {
    const hash = hashValue({ narration: scene.narration ?? null, duration: scene.duration });

    if (!scene.narration) {
      const finalSec = resolveFinalSec(scene, null, storyboard.defaults);
      scenes.push({ id: scene.id, audio: null, audioSec: null, finalSec, hash });
      continue;
    }

    const outPath = join(audioDir, `${scene.id}.mp3`);
    const { durationSec } = await provider.synthesize({ text: scene.narration, outPath, config });
    const finalSec = resolveFinalSec(scene, durationSec, storyboard.defaults);
    scenes.push({ id: scene.id, audio: relative(productDir, outPath), audioSec: durationSec, finalSec, hash });
  }

  return { scenes };
}
