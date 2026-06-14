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

test("caching: second run skips synthesize when hash matches and audio file exists on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-cache-"));
  const sb: Storyboard = {
    scenes: [
      { id: "01-narrated", capture: { kind: "titlecard" }, narration: "Hello world", duration: "auto" },
      { id: "02-silent", capture: { kind: "screenshot", route: "/" }, duration: 4 },
    ],
  };

  let synthesizeCount = 0;
  function countingProvider(): TtsProvider {
    return {
      synthesize: async (req) => {
        synthesizeCount++;
        await Bun.write(req.outPath, "x".repeat(1_000));
        return { durationSec: 5.8 };
      },
    };
  }

  // First run: no prior, synthesizes narrated scenes
  const prior = await runNarrate({ storyboard: sb, config, provider: countingProvider(), audioDir: dir, productDir: dir });
  const callsAfterFirst = synthesizeCount;
  expect(callsAfterFirst).toBe(1); // only the narrated scene

  // Second run: pass prior + force:false — should skip synthesize
  const m2 = await runNarrate({ storyboard: sb, config, provider: countingProvider(), audioDir: dir, productDir: dir, prior, force: false });
  expect(synthesizeCount).toBe(callsAfterFirst); // no new calls
  expect(m2.scenes[0]!.audioSec).toBeCloseTo(5.8);
  expect(m2.scenes[0]!.audio).toContain("01-narrated");

  // Third run: force:true — should re-synthesize
  await runNarrate({ storyboard: sb, config, provider: countingProvider(), audioDir: dir, productDir: dir, prior: m2, force: true });
  expect(synthesizeCount).toBe(callsAfterFirst + 1); // one more call
});

test("caching: recsynthesizes when narration text changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-tts-change-"));
  const sb1: Storyboard = {
    scenes: [{ id: "01-narrated", capture: { kind: "titlecard" }, narration: "Original text", duration: "auto" }],
  };

  let synthesizeCount = 0;
  function countingProvider(): TtsProvider {
    return {
      synthesize: async (req) => {
        synthesizeCount++;
        await Bun.write(req.outPath, "x".repeat(1_000));
        return { durationSec: 5.8 };
      },
    };
  }

  const prior = await runNarrate({ storyboard: sb1, config, provider: countingProvider(), audioDir: dir, productDir: dir });
  const callsAfterFirst = synthesizeCount;

  // Changed narration text — hash will differ, must re-synthesize
  const sb2: Storyboard = {
    scenes: [{ id: "01-narrated", capture: { kind: "titlecard" }, narration: "Changed text", duration: "auto" }],
  };
  await runNarrate({ storyboard: sb2, config, provider: countingProvider(), audioDir: dir, productDir: dir, prior, force: false });
  expect(synthesizeCount).toBe(callsAfterFirst + 1);
});
