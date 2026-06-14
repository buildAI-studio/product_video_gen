import type { CrawledLink, DiscoveredRoute } from "./types";

/**
 * Converts crawled links to clean, deduplicated, relative routes.
 *
 * - Resolves each href against appUrl; skips external origins.
 * - Skips non-http(s) schemes (mailto:, tel:, javascript:, hash-only anchors).
 * - Strips query string and hash; normalises trailing slash (strip, keep "/" as "/").
 * - Deduplicates by route (first occurrence wins).
 * - Drops the root route "/" (handled as the title card by generate).
 * - Cleans label text (collapse whitespace; fall back to route when empty).
 * - Caps result at `limit` entries in encounter order.
 */
export function toRoutes(
  links: CrawledLink[],
  appUrl: string,
  limit: number,
): DiscoveredRoute[] {
  const base = new URL(appUrl);
  const seen = new Set<string>();
  const results: DiscoveredRoute[] = [];

  for (const link of links) {
    if (results.length >= limit) break;

    const { href, text } = link;

    // Skip hash-only anchors and empty hrefs before URL parsing
    if (!href || href.startsWith("#")) continue;

    // Attempt to parse; skip anything that throws (malformed)
    let url: URL;
    try {
      url = new URL(href, appUrl);
    } catch {
      continue;
    }

    // Skip non-http(s) schemes (mailto:, tel:, javascript:, etc.)
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    // Skip external origins
    if (url.origin !== base.origin) continue;

    // Normalise: drop query + hash, strip trailing slash (keep root "/")
    let route = url.pathname;
    if (route !== "/" && route.endsWith("/")) {
      route = route.slice(0, -1);
    }

    // Drop the root route
    if (route === "/") continue;

    // Deduplicate
    if (seen.has(route)) continue;
    seen.add(route);

    // Clean label: collapse whitespace; fall back to route
    const label = text.replace(/\s+/g, " ").trim() || route;

    results.push({ route, label });
  }

  return results;
}
