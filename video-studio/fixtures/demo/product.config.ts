import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:4599",
  theme: {
    palette: { bg: "#101010", fg: "#ffffff", accent: "#4ea3ff" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 1280, height: 720, fps: 30 },
  locale: { primary: "en" },
};

export default config;
