import type { ProductConfig } from "../schema";

export type CrawledLink = { href: string; text: string };

/** Narrow seam over the browser crawl so discovery logic is testable without Playwright. */
export type DiscoverDriver = {
  /** Navigate appUrl (priming via config.prime), return all anchor links found on the landing page. */
  collectLinks(config: ProductConfig): Promise<CrawledLink[]>;
  close(): Promise<void>;
};

export type DiscoveredRoute = { route: string; label: string };
