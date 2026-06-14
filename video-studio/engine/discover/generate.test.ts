import { test, expect } from "bun:test";
import { generateStoryboard } from "./generate";
import { parseStoryboard } from "../schema";
import type { DiscoveredRoute } from "./types";

function routes(list: Array<{ route: string; label?: string }>): DiscoveredRoute[] {
  return list.map(({ route, label }) => ({ route, label: label ?? route }));
}

test("scene 1 is always the title card", () => {
  const sb = generateStoryboard(routes([{ route: "/dashboard", label: "Dashboard" }]));
  const first = sb.scenes[0]!;
  expect(first.id).toBe("01-title");
  expect(first.capture.kind).toBe("titlecard");
  expect(first.narration).toBeTruthy();
});

test("N routes produce N+1 scenes (title + one per route)", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/dashboard", label: "Dashboard" },
      { route: "/settings", label: "Settings" },
      { route: "/reports", label: "Reports" },
    ]),
  );
  expect(sb.scenes).toHaveLength(4);
});

test("scene ids are unique", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/a", label: "A" },
      { route: "/b", label: "B" },
      { route: "/c", label: "C" },
    ]),
  );
  const ids = sb.scenes.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("scene ids are two-digit-prefixed lower-kebab-case", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/dashboard", label: "Dashboard" },
      { route: "/user-profile", label: "User Profile" },
    ]),
  );
  for (const scene of sb.scenes) {
    expect(scene.id).toMatch(/^[a-z0-9-]+$/);
    // Two digit prefix (01, 02, 03...)
    expect(scene.id).toMatch(/^\d{2}-/);
  }
});

test("result passes parseStoryboard", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/dashboard", label: "Dashboard" },
      { route: "/settings", label: "Settings" },
    ]),
  );
  expect(() => parseStoryboard(sb)).not.toThrow();
});

test("last scene transitionOut is 'cut'", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/dashboard", label: "Dashboard" },
      { route: "/settings", label: "Settings" },
    ]),
  );
  const last = sb.scenes[sb.scenes.length - 1]!;
  expect(last.transitionOut).toBe("cut");
});

test("intermediate scenes have transitionOut 'fade'", () => {
  const sb = generateStoryboard(
    routes([
      { route: "/a", label: "A" },
      { route: "/b", label: "B" },
      { route: "/c", label: "C" },
    ]),
  );
  // scenes[0] is title (fade), scenes[1] and [2] are routes (fade), scenes[3] is last (cut)
  expect(sb.scenes[0]!.transitionOut).toBe("fade");
  expect(sb.scenes[1]!.transitionOut).toBe("fade");
  expect(sb.scenes[2]!.transitionOut).toBe("fade");
  expect(sb.scenes[3]!.transitionOut).toBe("cut");
});

test("screenshot scenes include correct route and label", () => {
  const sb = generateStoryboard(routes([{ route: "/dashboard", label: "Dashboard" }]));
  const dashScene = sb.scenes[1]!;
  expect(dashScene.capture.kind).toBe("screenshot");
  if (dashScene.capture.kind === "screenshot") {
    expect(dashScene.capture.route).toBe("/dashboard");
  }
  expect(dashScene.caption?.primary).toBe("Dashboard");
});

test("custom sceneDurationSec is applied to screenshot scenes", () => {
  const sb = generateStoryboard(
    routes([{ route: "/page", label: "Page" }]),
    { sceneDurationSec: 8 },
  );
  const page = sb.scenes[1]!;
  expect(page.duration).toBe(8);
});

test("default sceneDurationSec is 5", () => {
  const sb = generateStoryboard(routes([{ route: "/page", label: "Page" }]));
  expect(sb.scenes[1]!.duration).toBe(5);
});

test("handles empty routes list — produces only title card", () => {
  const sb = generateStoryboard(routes([]));
  expect(sb.scenes).toHaveLength(1);
  expect(sb.scenes[0]!.id).toBe("01-title");
  expect(() => parseStoryboard(sb)).not.toThrow();
});

test("disambiguates scene ids when slugs collide", () => {
  // Two routes that slug to the same thing
  const sb = generateStoryboard(
    routes([
      { route: "/--foo--", label: "--foo--" },
      { route: "/---foo---", label: "---foo---" },
    ]),
  );
  const ids = sb.scenes.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(() => parseStoryboard(sb)).not.toThrow();
});

test("slug falls back to 'page' for empty/special chars label", () => {
  const sb = generateStoryboard(routes([{ route: "/---", label: "---" }]));
  // The slug of "---" should be "page"
  expect(sb.scenes[1]!.id).toMatch(/page/);
  expect(() => parseStoryboard(sb)).not.toThrow();
});

test("motion is 'kenburns' on screenshot scenes", () => {
  const sb = generateStoryboard(routes([{ route: "/x", label: "X" }]));
  expect(sb.scenes[1]!.motion).toBe("kenburns");
});

test("defaults block is set", () => {
  const sb = generateStoryboard(routes([]));
  expect(sb.defaults?.motion).toBe("kenburns");
  expect(sb.defaults?.transitionOut).toBe("fade");
});

test("narration includes the label text", () => {
  const sb = generateStoryboard(routes([{ route: "/reports", label: "Reports" }]));
  expect(sb.scenes[1]!.narration).toContain("Reports");
});
