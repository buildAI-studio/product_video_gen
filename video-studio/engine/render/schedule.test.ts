import { test, expect } from "bun:test";
import { computeSchedule, totalFrames } from "./schedule";
import type { Storyboard } from "../schema";
import type { CaptureManifest, AudioManifest } from "../manifest";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard" }, caption: { primary: "Hi" }, narration: "x", duration: "auto", transitionOut: "fade" },
    { id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2, motion: "kenburns", transitionOut: "cut" },
  ],
};
const capture: CaptureManifest = {
  scenes: [
    { id: "01-title", kind: "titlecard", asset: "assets/01-title.png", ok: true, hash: "a" },
    { id: "02-home", kind: "screenshot", asset: "assets/02-home.png", ok: true, hash: "b" },
  ],
};
const audio: AudioManifest = {
  scenes: [
    { id: "01-title", audio: "audio/01-title.mp3", audioSec: 3, finalSec: 3, hash: "a" },
    { id: "02-home", audio: null, audioSec: null, finalSec: 2, hash: "b" },
  ],
};

test("computes cumulative frame timing at the given fps", () => {
  const sched = computeSchedule(storyboard, capture, audio, 30);
  expect(sched[0]!.durationInFrames).toBe(90);
  expect(sched[1]!.durationInFrames).toBe(60);
  expect(sched[0]!.audio).toBe("audio/01-title.mp3");
  expect(sched[1]!.audio).toBeNull();
});

test("totalFrames subtracts transition overlap", () => {
  const sched = computeSchedule(storyboard, capture, audio, 30);
  // 90 + 60, minus one 15-frame fade overlap (01-title.transitionOut="fade" precedes 02-home) = 135
  expect(totalFrames(sched)).toBe(135);
});

test("throws naming the scene when a capture entry is missing", () => {
  const bad: CaptureManifest = { scenes: [capture.scenes[0]!] };
  expect(() => computeSchedule(storyboard, bad, audio, 30)).toThrow(/02-home/);
});
