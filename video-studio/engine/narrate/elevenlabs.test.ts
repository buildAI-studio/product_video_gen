import { test, expect, mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createElevenLabsProvider } from "./elevenlabs";
import type { ProductConfig } from "../schema";

const config: ProductConfig = {
  appUrl: "http://localhost:1",
  theme: { palette: { bg: "#000", fg: "#fff", accent: "#f00" }, fonts: { heading: "A", body: "A" }, direction: "ltr" },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "voice-1" },
};

test("writes audio and returns the last alignment end time as duration", async () => {
  const audioB64 = Buffer.from("FAKEAUDIO").toString("base64");
  const fakeFetch = mock(async () =>
    new Response(
      JSON.stringify({ audio_base64: audioB64, alignment: { character_end_times_seconds: [0.5, 1.0, 4.2] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const provider = createElevenLabsProvider({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
  const dir = mkdtempSync(join(tmpdir(), "vs-el-"));
  const outPath = join(dir, "s.mp3");
  const r = await provider.synthesize({ text: "Hello", outPath, config });
  expect(r.durationSec).toBeCloseTo(4.2);
  expect((await Bun.file(outPath).arrayBuffer()).byteLength).toBe(9);
});

test("throws a clear error when the API key is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-el-nokey-"));
  const outPath = join(dir, "s.mp3");
  const provider = createElevenLabsProvider({ apiKey: "" });
  await expect(provider.synthesize({ text: "x", outPath, config })).rejects.toThrow(/ELEVENLABS_API_KEY/);
});
