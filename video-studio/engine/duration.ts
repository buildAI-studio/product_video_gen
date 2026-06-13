import type { Scene, Storyboard } from "./schema";

export const AUDIO_PADDING_SEC = 0.4;

/**
 * Resolve a scene's final on-screen length in seconds.
 * - `auto` + audio  → audio length + padding (so the VO has room to breathe)
 * - numeric + audio → max(audio, numeric) so narration is never cut off
 * - numeric, no audio → the authored number
 * - `auto`, no audio → defaults.duration if present, else a hard error
 */
export function resolveFinalSec(
  scene: Scene,
  audioSec: number | null,
  defaults: Storyboard["defaults"],
): number {
  const authored = scene.duration === "auto" ? null : scene.duration;

  if (audioSec != null) {
    return authored != null ? Math.max(audioSec, authored) : audioSec + AUDIO_PADDING_SEC;
  }

  const fallback = authored ?? defaults?.duration;
  if (fallback == null) {
    throw new Error(
      `scene "${scene.id}": duration is "auto" but no audio was generated and no defaults.duration is set`,
    );
  }
  return fallback;
}
