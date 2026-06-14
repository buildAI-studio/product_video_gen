import type { TtsProvider, TtsRequest, TtsResult } from "./types";

export type ElevenLabsOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  defaultModelId?: string;
};

type WithTimestampsResponse = {
  audio_base64: string;
  alignment: { character_end_times_seconds: number[] };
};

/** Concrete ElevenLabs TTS provider using the with-timestamps endpoint for exact duration. */
export function createElevenLabsProvider(opts: ElevenLabsOptions): TtsProvider {
  if (!opts.apiKey) {
    throw new Error("ElevenLabs API key missing — set ELEVENLABS_API_KEY in the environment");
  }
  const doFetch = opts.fetchImpl ?? fetch;
  const defaultModel = opts.defaultModelId ?? "eleven_multilingual_v2";

  return {
    async synthesize(req: TtsRequest): Promise<TtsResult> {
      const voice = req.config.voice;
      if (!voice) throw new Error("product config has no `voice` — set voice.id to an ElevenLabs voice id");

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "xi-api-key": opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ text: req.text, model_id: voice.modelId ?? defaultModel, output_format: "mp3_44100_128" }),
      });
      if (!res.ok) {
        throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as WithTimestampsResponse;
      const bytes = Buffer.from(data.audio_base64, "base64");
      await Bun.write(req.outPath, bytes);

      const ends = data.alignment.character_end_times_seconds;
      const durationSec = ends.length ? ends[ends.length - 1]! : 0;
      return { durationSec };
    },
  };
}
