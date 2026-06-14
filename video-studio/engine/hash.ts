import { createHash } from "node:crypto";

/** Deterministic JSON stringify with sorted object keys. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}

/** 16-hex-char content hash, stable across key ordering. Used as a per-scene cache key. */
export function hashValue(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
}
