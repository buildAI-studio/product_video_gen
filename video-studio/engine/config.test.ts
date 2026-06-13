import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadProduct } from "./config";

const ROOT = join(import.meta.dir, "..");

test("loads + validates a fixture product", async () => {
  const { config, storyboard, paths } = await loadProduct(ROOT, "demo", "fixtures");
  expect(config.output.width).toBe(1280);
  expect(storyboard.scenes).toHaveLength(2);
  expect(paths.dir).toBe(join(ROOT, "fixtures", "demo"));
});

test("throws a clear error for a missing product", async () => {
  await expect(loadProduct(ROOT, "nope", "fixtures")).rejects.toThrow(/nope/);
});
