import React, { createContext, useContext } from "react";
import type { ProductConfigData } from "../schema";

export type Theme = ProductConfigData["theme"];
export type Locale = ProductConfigData["locale"];

const ThemeContext = createContext<{ theme: Theme; locale: Locale } | null>(null);

export const ThemeProvider: React.FC<{ theme: Theme; locale: Locale; children: React.ReactNode }> = ({ theme, locale, children }) => (
  <ThemeContext.Provider value={{ theme, locale }}>{children}</ThemeContext.Provider>
);

export function useTheme(): { theme: Theme; locale: Locale } {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
