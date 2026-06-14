import type { ProductConfig } from "../schema";
import type { Storyboard } from "../schema";
import type { DiscoverDriver } from "./types";
import { toRoutes } from "./routes";
import { generateStoryboard } from "./generate";

/**
 * Orchestrates the auto-discovery flow:
 * 1. Collect crawled links via the driver (always closes driver in finally).
 * 2. Convert links to clean routes.
 * 3. Generate and return a draft Storyboard.
 */
export async function runDiscover(args: {
  config: ProductConfig;
  driver: DiscoverDriver;
  limit?: number;
}): Promise<Storyboard> {
  const { config, driver, limit = 12 } = args;
  try {
    const links = await driver.collectLinks(config);
    const routes = toRoutes(links, config.appUrl, limit);
    return generateStoryboard(routes);
  } finally {
    await driver.close();
  }
}
