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

test("titlecard scenes carry their titlecard options", () => {
  const sb: Storyboard = {
    scenes: [
      { id: "01-title", capture: { kind: "titlecard", logo: true, bg: "#123456" }, narration: "x", duration: "auto" },
    ],
  };
  const cap: CaptureManifest = {
    scenes: [{ id: "01-title", kind: "titlecard", asset: "assets/01-title.png", ok: true, hash: "a" }],
  };
  const aud: AudioManifest = {
    scenes: [{ id: "01-title", audio: "audio/01-title.mp3", audioSec: 2, finalSec: 2, hash: "a" }],
  };
  const sched = computeSchedule(sb, cap, aud, 30);
  expect(sched[0]!.titlecard).toEqual({ bg: "#123456", logo: true });
});

test("screenshot scene with focus box in capture manifest yields ScheduledScene.focus", () => {
  const sb: Storyboard = {
    scenes: [
      { id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 2, focus: { selector: "#kpi", label: "KPI" } },
    ],
  };
  const cap: CaptureManifest = {
    scenes: [
      {
        id: "02-home",
        kind: "screenshot",
        asset: "assets/02-home.png",
        ok: true,
        hash: "b",
        focus: { x: 100, y: 200, w: 300, h: 80, label: "KPI" },
      },
    ],
  };
  const aud: AudioManifest = {
    scenes: [{ id: "02-home", audio: null, audioSec: null, finalSec: 2, hash: "b" }],
  };
  const sched = computeSchedule(sb, cap, aud, 30);
  expect(sched[0]!.focus).toEqual({ x: 100, y: 200, w: 300, h: 80, label: "KPI" });
});

test("interaction scene's authored trimStartSec is carried onto the scheduled scene", () => {
  const sb: Storyboard = {
    scenes: [{ id: "02-rec", capture: { kind: "interaction", route: "/", steps: [{ action: "wait", for: 100 }] }, duration: 5, trimStartSec: 2 }],
  };
  const cap: CaptureManifest = { scenes: [{ id: "02-rec", kind: "interaction", asset: "assets/02-rec.mp4", ok: true, hash: "a" }] };
  const aud: AudioManifest = { scenes: [{ id: "02-rec", audio: null, audioSec: null, finalSec: 5, hash: "a" }] };
  const sched = computeSchedule(sb, cap, aud, 30);
  expect(sched[0]!.trimStartSec).toBe(2);
});
