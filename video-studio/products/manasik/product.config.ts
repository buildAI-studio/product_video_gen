import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:3000",
  theme: {
    palette: { bg: "#0d110d", fg: "#ffffff", accent: "#c8a45c" },
    fonts: { heading: "Tajawal", body: "Tajawal" },
    direction: "rtl",
    logo: "assets/logo.svg",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "ar", secondary: "en" },
  voice: { id: "REPLACE_WITH_ELEVENLABS_VOICE_ID" },

  // Prime dark + Arabic + most-permissive role before first paint (per the spec).
  prime: async (page) => {
    await (page as { addInitScript: (fn: () => void) => Promise<void> }).addInitScript(() => {
      localStorage.setItem("theme", "dark");
      localStorage.setItem("locale", "ar");
    });
  },

  // Scene 5 needs a concrete guest id; resolve [firstId] here.
  resolveRoute: (route) => route.replace("[firstId]", "g-1"),
};

export default config;
