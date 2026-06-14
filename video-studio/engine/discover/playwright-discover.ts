import { chromium, type Browser } from "playwright";
import type { ProductConfig } from "../schema";
import type { CrawledLink, DiscoverDriver } from "./types";

export function createPlaywrightDiscoverDriver(): DiscoverDriver {
  let browser: Browser | null = null;
  return {
    async collectLinks(config: ProductConfig): Promise<CrawledLink[]> {
      if (!browser) browser = await chromium.launch();
      const context = await browser.newContext({
        viewport: { width: config.output.width, height: config.output.height },
      });
      const page = await context.newPage();
      if (config.prime) await config.prime(page);
      try {
        await page.goto(config.appUrl, { waitUntil: "networkidle", timeout: 15_000 });
        const links = await page.$$eval("a[href]", (els) =>
          els.map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent ?? "").trim() })),
        );
        return links;
      } finally {
        await context.close();
      }
    },
    async close() {
      if (browser) {
        await browser.close();
        browser = null;
      }
    },
  };
}
