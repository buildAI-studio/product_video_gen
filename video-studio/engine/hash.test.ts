import { test, expect } from "bun:test";
import { hashValue } from "./hash";

test("is stable regardless of key order", () => {
  expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
});

test("changes when content changes", () => {
  expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
});

test("returns a short hex string", () => {
  expect(hashValue({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
});
