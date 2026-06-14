import type { Storyboard } from "../schema";
import type { DiscoveredRoute } from "./types";

/**
 * Converts a URL-path/label string into a lower-kebab-case slug.
 * Replaces runs of non-alphanumeric characters with "-", trims leading/trailing "-".
 * Falls back to "page" if the result is empty.
 */
function slug(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "page";
}

/**
 * Zero-pads a number to at least two digits.
 */
function twoDigit(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Generates a draft Storyboard from a list of discovered routes.
 *
 * - Scene 1 is always a title card (id: "01-title").
 * - One screenshot scene per route follows, numbered sequentially.
 * - The last scene's transitionOut is "cut"; all others default to "fade".
 * - All scene ids are unique (disambiguation suffix added when slugs collide).
 * - The returned object satisfies parseStoryboard.
 */
export function generateStoryboard(
  routes: DiscoveredRoute[],
  opts?: { sceneDurationSec?: number },
): Storyboard {
  const durationSec = opts?.sceneDurationSec ?? 5;

  const scenes: Storyboard["scenes"] = [];

  // Scene 1: title card
  scenes.push({
    id: "01-title",
    capture: { kind: "titlecard", logo: true },
    caption: { primary: "TODO: product name" },
    narration: "TODO: intro narration.",
    duration: "auto",
    transitionOut: "fade",
  });

  // Track used ids to ensure uniqueness
  const usedIds = new Set<string>(["01-title"]);

  // One scene per route
  routes.forEach((r, idx) => {
    const sceneNum = idx + 2; // 1-indexed; scene 1 is the title card
    const rawSlug = slug(r.label !== r.route ? r.label : r.route);

    // Ensure unique id
    let candidateId = `${twoDigit(sceneNum)}-${rawSlug}`;
    if (usedIds.has(candidateId)) {
      candidateId = `${twoDigit(sceneNum)}-${rawSlug}-${idx + 1}`;
    }
    // Fallback with index if still colliding (shouldn't happen with two-digit prefix)
    if (usedIds.has(candidateId)) {
      candidateId = `${twoDigit(sceneNum)}-page-${idx + 1}`;
    }
    usedIds.add(candidateId);

    const isLast = idx === routes.length - 1;

    scenes.push({
      id: candidateId,
      capture: { kind: "screenshot", route: r.route },
      caption: { primary: r.label },
      narration: `TODO: narration for ${r.label}.`,
      duration: durationSec,
      motion: "kenburns",
      transitionOut: isLast ? "cut" : "fade",
    });
  });

  // If there are no routes (only the title card), set its transitionOut to "cut"
  if (routes.length === 0) {
    const titleScene = scenes[0]!;
    scenes[0] = { ...titleScene, transitionOut: "cut" };
  }

  return {
    defaults: { motion: "kenburns", transitionOut: "fade" },
    scenes,
  };
}
