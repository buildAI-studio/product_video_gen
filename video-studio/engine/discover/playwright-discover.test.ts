import { test, expect, afterAll } from "bun:test";
import { join } from "node:path";
import { createPlaywrightDiscoverDriver } from "./playwright-discover";
import { toRoutes } from "./routes";
import type { ProductConfig } from "../schema";

// Serve the discover-app fixture so the driver has a real app to crawl.
const server = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(Bun.file(join(import.meta.dir, "../../fixtures/discover-app/index.html")), {
      headers: { "content-type": "text/html" },
    }),
});
const appUrl = `http://localhost:${server.port}`;

afterAll(() => server.stop(true));

const config: ProductConfig = {
  appUrl,
  theme: {
    palette: { bg: "#000", fg: "#fff", accent: "#f00" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 1280, height: 720, fps: 30 },
  locale: { primary: "en" },
};

test(
  "collectLinks drives a headless browser and returns anchors from the fixture page",
  async () => {
    const driver = createPlaywrightDiscoverDriver();
    let links: Awaited<ReturnType<typeof driver.collectLinks>>;
    try {
      links = await driver.collectLinks(config);
    } finally {
      await driver.close();
    }

    // The fixture has 5 anchor elements — expect at least 5 collected
    expect(links.length).toBeGreaterThanOrEqual(5);

    const hrefs = links.map((l) => l.href);
    // Should include the internal routes (resolved to full URLs by the browser)
    expect(hrefs.some((h) => h.endsWith("/dashboard"))).toBe(true);
    expect(hrefs.some((h) => h.endsWith("/reports"))).toBe(true);
  },
  120_000,
);

test(
  "toRoutes applied to crawled links deduplicates and drops external + mailto",
  async () => {
    const driver = createPlaywrightDiscoverDriver();
    let links: Awaited<ReturnType<typeof driver.collectLinks>>;
    try {
      links = await driver.collectLinks(config);
    } finally {
      await driver.close();
    }

    const routes = toRoutes(links, appUrl, 12);
    const routePaths = routes.map((r) => r.route);

    // Internal routes present
    expect(routePaths).toContain("/dashboard");
    expect(routePaths).toContain("/reports");

    // External origin and mailto must be filtered out
    expect(routePaths.every((r) => !r.startsWith("https://external.example.com"))).toBe(true);
    expect(routePaths.every((r) => !r.startsWith("mailto:"))).toBe(true);

    // Deduplicated: /dashboard appears only once despite two anchors pointing to it
    expect(routePaths.filter((r) => r === "/dashboard")).toHaveLength(1);
  },
  120_000,
);
