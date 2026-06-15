import type { ProductConfig } from "../../engine/schema";

/**
 * IVMS — Integrated Vehicle Management System (fleet-mang/ivms-app).
 *
 * The app is a state-routed SPA: only `/login` and `/` are real URLs, and every
 * "page" is a sidebar tab switched in React state. So feature scenes navigate to
 * `/` and click the sidebar button (by its data-sidebar="menu-button" + label)
 * before the screenshot — see storyboard.ts.
 *
 * `prime` seeds localStorage before first paint: English + dark theme + an admin
 * session (dev auth), so all tabs are visible and populated with seed data without
 * a backend. Run the app offline first: in ivms-app, VITE_API_BACKED=false +
 * VITE_DEV_AUTH=true (a .env.local override), then `npm run dev`.
 */
const config: ProductConfig = {
  appUrl: "http://localhost:5175",
  theme: {
    palette: { bg: "#0b0f0e", fg: "#ffffff", accent: "#2dd4bf" },
    fonts: { heading: "Helvetica Neue", body: "Helvetica Neue" },
    direction: "ltr",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "WRTiUEhnYuLOuf6I0PHk" },

  prime: async (page) => {
    await (page as { addInitScript: (fn: () => void) => Promise<void> }).addInitScript(() => {
      localStorage.setItem("language", "en");
      localStorage.setItem("theme", "dark");
      localStorage.setItem("accessToken", "dev-token-demo");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "demo-1",
          username: "admin",
          fullName: "Admin User",
          department: "ADMIN",
          role: "SUPER_ADMIN",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      );
    });
  },
};

export default config;
