import type { ProductConfig } from "../schema";

export type TtsRequest = {
  text: string;
  outPath: string; // absolute path to write the audio file
  config: ProductConfig;
};

export type TtsResult = { durationSec: number };

/** Narrow seam over the TTS API so the narrate stage is testable without network. */
export type TtsProvider = {
  synthesize(req: TtsRequest): Promise<TtsResult>;
};
