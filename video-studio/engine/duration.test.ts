import { test, expect } from "bun:test";
import { resolveFinalSec, AUDIO_PADDING_SEC } from "./duration";
import type { Scene, Storyboard } from "./schema";

const base = (over: Partial<Scene>): Scene =>
  ({ id: "s", capture: { kind: "titlecard" }, duration: 5, ...over }) as Scene;

const defaults: Storyboard["defaults"] = { duration: 4 };

test("auto with audio = audio + padding", () => {
  const s = base({ duration: "auto", narration: "hi" });
  expect(resolveFinalSec(s, 5.8, defaults)).toBeCloseTo(5.8 + AUDIO_PADDING_SEC);
});

test("numeric with audio = max(audio, numeric) so VO never clips", () => {
  expect(resolveFinalSec(base({ duration: 5 }), 6.2, defaults)).toBeCloseTo(6.2);
  expect(resolveFinalSec(base({ duration: 8 }), 6.2, defaults)).toBeCloseTo(8);
});

test("numeric, no audio = authored number", () => {
  expect(resolveFinalSec(base({ duration: 5 }), null, defaults)).toBe(5);
});

test("auto, no audio = falls back to defaults.duration", () => {
  expect(resolveFinalSec(base({ duration: "auto", narration: "hi" }), null, defaults)).toBe(4);
});

test("auto, no audio, no default = throws naming the scene", () => {
  const s = base({ id: "boom", duration: "auto", narration: "hi" });
  expect(() => resolveFinalSec(s, null, undefined)).toThrow(/boom/);
});
