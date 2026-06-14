import { test, expect } from "bun:test";
import { runDiscover } from "./discover";
import { parseStoryboard } from "../schema";
import type { ProductConfig } from "../schema";
import type { DiscoverDriver, CrawledLink } from "./types";

const config: ProductConfig = {
  appUrl: "http://localhost:3000",
  theme: {
    palette: { bg: "#000", fg: "#fff", accent: "#f00" },
    fonts: { heading: "A", body: "A" },
    direction: "ltr",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
};

function fakeDriver(links: CrawledLink[], opts?: { onClose?: () => void }): DiscoverDriver & { closedCount: number } {
  let closedCount = 0;
  return {
    closedCount: 0,
    async collectLinks(_cfg: ProductConfig): Promise<CrawledLink[]> {
      return links;
    },
    async close(): Promise<void> {
      closedCount++;
      // Update the object's own property so tests can check it
      (this as { closedCount: number }).closedCount = closedCount;
      opts?.onClose?.();
    },
  };
}

const sampleLinks: CrawledLink[] = [
  { href: "http://localhost:3000/dashboard", text: "Dashboard" },
  { href: "http://localhost:3000/settings", text: "Settings" },
  { href: "http://localhost:3000/reports", text: "Reports" },
  // External link — should be filtered
  { href: "https://example.com/page", text: "External" },
  // mailto — should be filtered
  { href: "mailto:hello@example.com", text: "Email" },
  // Root route — should be filtered (becomes title card)
  { href: "http://localhost:3000/", text: "Home" },
];

test("returns a Storyboard with title card + internal routes", async () => {
  const driver = fakeDriver(sampleLinks);
  const sb = await runDiscover({ config, driver });

  // Should have title card + 3 internal routes
  expect(sb.scenes).toHaveLength(4);
  expect(sb.scenes[0]!.id).toBe("01-title");
  expect(sb.scenes[0]!.capture.kind).toBe("titlecard");
});

test("only internal routes appear as screenshot scenes", async () => {
  const driver = fakeDriver(sampleLinks);
  const sb = await runDiscover({ config, driver });

  const screenshotRoutes = sb.scenes
    .filter((s) => s.capture.kind === "screenshot")
    .map((s) => (s.capture as { kind: "screenshot"; route: string }).route);

  expect(screenshotRoutes).toEqual(["/dashboard", "/settings", "/reports"]);
});

test("driver.close() is always called", async () => {
  let closeCalled = false;
  const driver = fakeDriver(sampleLinks, { onClose: () => { closeCalled = true; } });
  await runDiscover({ config, driver });
  expect(closeCalled).toBe(true);
});

test("driver.close() is called even when collectLinks throws", async () => {
  let closeCalled = false;
  const errorDriver: DiscoverDriver = {
    async collectLinks(): Promise<CrawledLink[]> {
      throw new Error("network error");
    },
    async close(): Promise<void> {
      closeCalled = true;
    },
  };

  await expect(runDiscover({ config, driver: errorDriver })).rejects.toThrow("network error");
  expect(closeCalled).toBe(true);
});

test("returned storyboard passes parseStoryboard", async () => {
  const driver = fakeDriver(sampleLinks);
  const sb = await runDiscover({ config, driver });
  expect(() => parseStoryboard(sb)).not.toThrow();
});

test("respects the limit option", async () => {
  const manyLinks: CrawledLink[] = Array.from({ length: 20 }, (_, i) => ({
    href: `http://localhost:3000/page-${i + 1}`,
    text: `Page ${i + 1}`,
  }));
  const driver = fakeDriver(manyLinks);
  const sb = await runDiscover({ config, driver, limit: 5 });

  // 1 title + 5 routes
  expect(sb.scenes).toHaveLength(6);
});

test("default limit is 12", async () => {
  const manyLinks: CrawledLink[] = Array.from({ length: 20 }, (_, i) => ({
    href: `http://localhost:3000/page-${i + 1}`,
    text: `Page ${i + 1}`,
  }));
  const driver = fakeDriver(manyLinks);
  const sb = await runDiscover({ config, driver });

  // 1 title + 12 routes
  expect(sb.scenes).toHaveLength(13);
});

test("returns only title card when no valid links found", async () => {
  const driver = fakeDriver([
    { href: "mailto:x@y.com", text: "Email" },
    { href: "#top", text: "Top" },
    { href: "/", text: "Home" },
  ]);
  const sb = await runDiscover({ config, driver });
  expect(sb.scenes).toHaveLength(1);
  expect(sb.scenes[0]!.capture.kind).toBe("titlecard");
  expect(() => parseStoryboard(sb)).not.toThrow();
});
