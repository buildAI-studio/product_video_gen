import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { runNarrate } from "./narrate";
import type { TtsProvider } from "./types";
import type { Storyboard, ProductConfig } from "../schema";

const config: ProductConfig = {
  appUrl: "http://localhost:1",
  theme: { palette: { bg: "#000", fg: "#fff", accent: "#f00" }, fonts: { heading: "A", body: "A" }, direction: "ltr" },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "voice-1" },
};

function fakeProvider(sec = 5.8): TtsProvider {
  return { synthesize: async () => ({ durationSec: sec }) };
}

test("synthesizes narrated scenes and resolves finalSec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-"));
  const sb: Storyboard = {
    scenes: [{ id: "01-title", capture: { kind: "titlecard" }, narration: "Hello", duration: "auto" }],
  };
  const m = await runNarrate({ storyboard: sb, config, provider: fakeProvider(5.8), audioDir: dir, productDir: dir });
  expect(m.scenes[0]!.audioSec).toBeCloseTo(5.8);
  expect(m.scenes[0]!.finalSec).toBeCloseTo(5.8 + 0.4);
  expect(m.scenes[0]!.audio).toContain("01-title");
});

test("scenes without narration get null audio and authored finalSec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-"));
  const sb: Storyboard = { scenes: [{ id: "02-home", capture: { kind: "screenshot", route: "/" }, duration: 4 }] };
  const m = await runNarrate({ storyboard: sb, config, provider: fakeProvider(), audioDir: dir, productDir: dir });
  expect(m.scenes[0]!.audio).toBeNull();
  expect(m.scenes[0]!.audioSec).toBeNull();
  expect(m.scenes[0]!.finalSec).toBe(4);
});
