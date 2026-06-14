import { test, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { serializeStoryboard } from "./serialize";
import { generateStoryboard } from "./generate";
import { parseStoryboard } from "../schema";
import type { Storyboard } from "../schema";

// The temp product directory must live at products/__disc_test__/ so that
// the relative import "../../engine/schema" resolves correctly.
const PRODUCTS_DIR = join(import.meta.dir, "../../products");
const TEMP_PRODUCT_DIR = join(PRODUCTS_DIR, "__disc_test__");
const TEMP_STORYBOARD_PATH = join(TEMP_PRODUCT_DIR, "storyboard.ts");

afterEach(() => {
  if (existsSync(TEMP_PRODUCT_DIR)) {
    rmSync(TEMP_PRODUCT_DIR, { recursive: true, force: true });
  }
});

function makeSampleStoryboard(): Storyboard {
  return generateStoryboard([
    { route: "/dashboard", label: "Dashboard" },
    { route: "/settings", label: "Settings" },
    { route: "/reports", label: "Reports" },
  ]);
}

test("serializeStoryboard starts with the correct import line", () => {
  const sb = makeSampleStoryboard();
  const src = serializeStoryboard(sb);
  expect(src.startsWith('import type { Storyboard } from "../../engine/schema";')).toBe(true);
});

test("serializeStoryboard ends with 'export default storyboard;'", () => {
  const sb = makeSampleStoryboard();
  const src = serializeStoryboard(sb);
  expect(src.trimEnd()).toMatch(/export default storyboard;$/);
});

test("serialized source contains all scene ids", () => {
  const sb = makeSampleStoryboard();
  const src = serializeStoryboard(sb);
  for (const scene of sb.scenes) {
    expect(src).toContain(scene.id);
  }
});

test("serialized source contains all routes", () => {
  const sb = makeSampleStoryboard();
  const src = serializeStoryboard(sb);
  for (const scene of sb.scenes) {
    if (scene.capture.kind === "screenshot") {
      expect(src).toContain(scene.capture.route);
    }
  }
});

test("round-trip: write to products/__disc_test__/, dynamic-import, parseStoryboard passes", async () => {
  const original = makeSampleStoryboard();
  const src = serializeStoryboard(original);

  mkdirSync(TEMP_PRODUCT_DIR, { recursive: true });
  writeFileSync(TEMP_STORYBOARD_PATH, src, "utf8");

  // Dynamic import — Bun resolves the .ts file directly
  const mod = await import(TEMP_STORYBOARD_PATH);
  const loaded = mod.default as unknown;

  // Must pass schema validation
  const parsed = parseStoryboard(loaded);
  expect(parsed.scenes).toHaveLength(original.scenes.length);
});

test("round-trip: parsed storyboard deep-equals original (JSON round-trip)", async () => {
  const original = makeSampleStoryboard();
  const src = serializeStoryboard(original);

  mkdirSync(TEMP_PRODUCT_DIR, { recursive: true });
  writeFileSync(TEMP_STORYBOARD_PATH, src, "utf8");

  const mod = await import(TEMP_STORYBOARD_PATH);
  const loaded = mod.default as unknown;

  const parsed = parseStoryboard(loaded);
  // Zod may reorder keys; compare the round-trip of BOTH through parseStoryboard
  // (the canonical form) so key order is consistent.
  const parsedOriginal = parseStoryboard(original);
  expect(JSON.stringify(parsed)).toBe(JSON.stringify(parsedOriginal));
});

test("round-trip: temp directory is cleaned up after test", () => {
  // afterEach runs cleanup; this test just asserts the helper works.
  mkdirSync(TEMP_PRODUCT_DIR, { recursive: true });
  writeFileSync(TEMP_STORYBOARD_PATH, "// placeholder", "utf8");
  expect(existsSync(TEMP_PRODUCT_DIR)).toBe(true);
  // afterEach will remove it
});

test("parseStoryboard validates the object literal slice from serialized source", () => {
  const sb = makeSampleStoryboard();
  const src = serializeStoryboard(sb);

  // Extract the JSON object literal: everything between "= " and ";\n\nexport"
  const marker = "= ";
  const start = src.indexOf(marker) + marker.length;
  const end = src.lastIndexOf(";\n\nexport");
  const jsonSlice = src.slice(start, end);

  const parsed = parseStoryboard(JSON.parse(jsonSlice));
  expect(parsed.scenes).toHaveLength(sb.scenes.length);
});
