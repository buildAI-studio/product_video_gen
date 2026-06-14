import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import {
  writeCaptureManifest,
  readCaptureManifest,
  writeAudioManifest,
  readAudioManifest,
  type CaptureManifest,
  type AudioManifest,
} from "./manifest";

test("round-trips a capture manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  const path = join(dir, "capture.json");
  const m: CaptureManifest = {
    scenes: [{ id: "01-title", kind: "titlecard", asset: "assets/01-title.png", ok: true, w: 1920, h: 1080, hash: "abc" }],
  };
  await writeCaptureManifest(path, m);
  expect(await readCaptureManifest(path)).toEqual(m);
});

test("round-trips an audio manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  const path = join(dir, "audio.json");
  const m: AudioManifest = {
    scenes: [{ id: "01-title", audio: "audio/01-title.mp3", audioSec: 3.2, finalSec: 3.6, hash: "abc" }],
  };
  await writeAudioManifest(path, m);
  expect(await readAudioManifest(path)).toEqual(m);
});

test("reading a missing manifest returns null", async () => {
  expect(await readCaptureManifest("/no/such/capture.json")).toBeNull();
});
