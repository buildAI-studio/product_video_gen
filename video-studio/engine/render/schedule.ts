import type { LocalizedText, Storyboard } from "../schema";
import type { AudioManifest, CaptureManifest } from "../manifest";
import { TRANSITION_FRAMES } from "./constants";

export type ScheduledScene = {
  id: string;
  kind: "screenshot" | "interaction" | "titlecard";
  asset: string;
  audio: string | null;
  durationInFrames: number;
  caption?: { primary: string; secondary?: string };
  motion: "kenburns" | "none";
  transitionOut: "cut" | "fade" | "slide";
  titlecard?: { bg?: string; logo?: boolean };
};

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function computeSchedule(
  storyboard: Storyboard,
  capture: CaptureManifest,
  audio: AudioManifest,
  fps: number,
): ScheduledScene[] {
  const caps = byId(capture.scenes);
  const auds = byId(audio.scenes);
  const defaultMotion = storyboard.defaults?.motion ?? "none";
  const defaultTransition = storyboard.defaults?.transitionOut ?? "cut";

  const out: ScheduledScene[] = [];
  for (const scene of storyboard.scenes) {
    const cap = caps.get(scene.id);
    const aud = auds.get(scene.id);
    if (!cap) throw new Error(`render: no capture manifest entry for scene "${scene.id}" — run capture first`);
    if (!aud) throw new Error(`render: no audio manifest entry for scene "${scene.id}" — run narrate first`);

    const durationInFrames = Math.max(1, Math.round(aud.finalSec * fps));
    out.push({
      id: scene.id,
      kind: cap.kind,
      asset: cap.asset,
      audio: aud.audio,
      durationInFrames,
      caption: scene.caption as LocalizedText | undefined,
      motion: scene.motion ?? defaultMotion,
      transitionOut: scene.transitionOut ?? defaultTransition,
      ...(scene.capture.kind === "titlecard"
        ? { titlecard: { bg: scene.capture.bg, logo: scene.capture.logo } }
        : {}),
    });
  }
  return out;
}

export function totalFrames(schedule: ScheduledScene[]): number {
  let total = 0;
  for (let i = 0; i < schedule.length; i++) {
    total += schedule[i]!.durationInFrames;
    const prev = schedule[i - 1];
    if (i > 0 && prev && prev.transitionOut !== "cut") total -= TRANSITION_FRAMES;
  }
  return Math.max(1, total);
}
