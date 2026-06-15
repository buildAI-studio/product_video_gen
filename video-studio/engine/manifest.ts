import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type CaptureSceneEntry = {
  id: string;
  kind: "screenshot" | "interaction" | "titlecard";
  asset: string; // relative to the product dir
  ok: boolean;
  w?: number;
  h?: number;
  hash: string; // hash of the scene's capture slice
  focus?: { x: number; y: number; w: number; h: number; label?: string };
};
export type CaptureManifest = { scenes: CaptureSceneEntry[] };

export type AudioSceneEntry = {
  id: string;
  audio: string | null; // relative path, or null when no narration
  audioSec: number | null;
  finalSec: number;
  hash: string; // hash of the scene's narration+duration slice
};
export type AudioManifest = { scenes: AudioSceneEntry[] };

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(value, null, 2));
}

async function readJson<T>(path: string): Promise<T | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return (await file.json()) as T;
}

export const writeCaptureManifest = (path: string, m: CaptureManifest) => writeJson(path, m);
export const readCaptureManifest = (path: string) => readJson<CaptureManifest>(path);
export const writeAudioManifest = (path: string, m: AudioManifest) => writeJson(path, m);
export const readAudioManifest = (path: string) => readJson<AudioManifest>(path);
