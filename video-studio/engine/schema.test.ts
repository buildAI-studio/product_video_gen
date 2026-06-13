import { test, expect } from "bun:test";
import { parseStoryboard, parseProductConfig } from "./schema";

const validScene = {
  id: "01-title",
  capture: { kind: "titlecard", logo: true },
  caption: { primary: "مناسك", secondary: "Manasik" },
  narration: "Manasik — unified operations.",
  duration: "auto",
  transitionOut: "fade",
};

test("accepts a valid storyboard", () => {
  const sb = parseStoryboard({ scenes: [validScene] });
  expect(sb.scenes[0]!.id).toBe("01-title");
});

test("rejects an unknown capture kind with a path", () => {
  expect(() => parseStoryboard({ scenes: [{ ...validScene, capture: { kind: "video" } }] }))
    .toThrow(/capture/);
});

test("rejects duration 'auto' without narration", () => {
  const noNarration = { ...validScene };
  delete (noNarration as Record<string, unknown>).narration;
  expect(() => parseStoryboard({ scenes: [noNarration] })).toThrow(/narration/);
});

test("rejects an empty scenes array", () => {
  expect(() => parseStoryboard({ scenes: [] })).toThrow();
});

test("accepts a valid product config", () => {
  const cfg = parseProductConfig({
    appUrl: "http://localhost:3000",
    theme: {
      palette: { bg: "#0d110d", fg: "#fff", accent: "#c8a45c" },
      fonts: { heading: "Tajawal", body: "Tajawal" },
      direction: "rtl",
    },
    output: { width: 1920, height: 1080, fps: 30 },
    locale: { primary: "ar", secondary: "en" },
  });
  expect(cfg.output.fps).toBe(30);
});
