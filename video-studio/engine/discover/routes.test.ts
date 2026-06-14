import { test, expect } from "bun:test";
import { toRoutes } from "./routes";
import type { CrawledLink } from "./types";

const APP_URL = "http://localhost:3000";

function links(list: Array<{ href: string; text?: string }>): CrawledLink[] {
  return list.map(({ href, text = "label" }) => ({ href, text }));
}

test("filters external links", () => {
  const result = toRoutes(
    links([
      { href: "http://localhost:3000/dashboard", text: "Dashboard" },
      { href: "https://example.com/page", text: "External" },
    ]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(1);
  expect(result[0]!.route).toBe("/dashboard");
});

test("filters mailto: links", () => {
  const result = toRoutes(
    links([{ href: "mailto:hello@example.com", text: "Email" }]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(0);
});

test("filters tel: links", () => {
  const result = toRoutes(links([{ href: "tel:+1234567890", text: "Call" }]), APP_URL, 10);
  expect(result).toHaveLength(0);
});

test("filters javascript: links", () => {
  const result = toRoutes(
    links([{ href: "javascript:void(0)", text: "noop" }]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(0);
});

test("filters hash-only anchors", () => {
  const result = toRoutes(links([{ href: "#section", text: "Jump" }]), APP_URL, 10);
  expect(result).toHaveLength(0);
});

test("strips query string and hash from URLs", () => {
  const result = toRoutes(
    links([{ href: "http://localhost:3000/search?q=foo#bar", text: "Search" }]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(1);
  expect(result[0]!.route).toBe("/search");
});

test("strips trailing slash from non-root paths", () => {
  const result = toRoutes(
    links([{ href: "http://localhost:3000/about/", text: "About" }]),
    APP_URL,
    10,
  );
  expect(result[0]!.route).toBe("/about");
});

test("deduplicates by route, first occurrence wins", () => {
  const result = toRoutes(
    links([
      { href: "http://localhost:3000/dashboard", text: "First" },
      { href: "http://localhost:3000/dashboard", text: "Second" },
      { href: "/dashboard", text: "Third" },
    ]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(1);
  expect(result[0]!.label).toBe("First");
});

test("deduplicates when same route reached via different representations", () => {
  const result = toRoutes(
    links([
      { href: "/settings", text: "Settings A" },
      { href: "http://localhost:3000/settings", text: "Settings B" },
    ]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(1);
  expect(result[0]!.label).toBe("Settings A");
});

test("drops the root route '/'", () => {
  const result = toRoutes(
    links([
      { href: "/", text: "Home" },
      { href: "http://localhost:3000/", text: "Root" },
      { href: "/dashboard", text: "Dashboard" },
    ]),
    APP_URL,
    10,
  );
  expect(result).toHaveLength(1);
  expect(result[0]!.route).toBe("/dashboard");
});

test("applies limit, keeping first N in encounter order", () => {
  const result = toRoutes(
    links([
      { href: "/a", text: "A" },
      { href: "/b", text: "B" },
      { href: "/c", text: "C" },
      { href: "/d", text: "D" },
    ]),
    APP_URL,
    3,
  );
  expect(result).toHaveLength(3);
  expect(result.map((r) => r.route)).toEqual(["/a", "/b", "/c"]);
});

test("label falls back to route when link text is empty", () => {
  const result = toRoutes(links([{ href: "/settings", text: "" }]), APP_URL, 10);
  expect(result[0]!.label).toBe("/settings");
});

test("label falls back to route when link text is only whitespace", () => {
  const result = toRoutes(links([{ href: "/profile", text: "   \n\t  " }]), APP_URL, 10);
  expect(result[0]!.label).toBe("/profile");
});

test("collapses internal whitespace in labels", () => {
  const result = toRoutes(
    links([{ href: "/reports", text: "  Reports\n  Overview  " }]),
    APP_URL,
    10,
  );
  expect(result[0]!.label).toBe("Reports Overview");
});

test("resolves relative hrefs against appUrl", () => {
  const result = toRoutes(links([{ href: "/users", text: "Users" }]), APP_URL, 10);
  expect(result[0]!.route).toBe("/users");
});

test("returns empty array for no valid links", () => {
  const result = toRoutes(links([{ href: "mailto:x@y.com" }, { href: "#top" }]), APP_URL, 10);
  expect(result).toHaveLength(0);
});
