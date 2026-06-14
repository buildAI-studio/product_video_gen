import type { Capture, ProductConfig, Step } from "../schema";

export type ScreenshotRequest = {
  kind: "screenshot" | "titlecard";
  route?: string; // absolute url; undefined for titlecard
  waitFor?: string;
  steps?: Step[]; // optional pre-screenshot interaction steps (screenshot kind only)
  outPath: string; // absolute path to write the PNG
  capture: Capture; // full capture node (titlecard bg/logo, etc.)
};

export type ClipRequest = {
  kind: "interaction";
  route: string; // absolute url
  capture: Extract<Capture, { kind: "interaction" }>;
  outPath: string; // absolute path to write the clip
};

export type DriverResult = { bytes: number; w: number; h: number };

/** Narrow seam over Playwright so the capture stage is testable without a browser. */
export type PageDriver = {
  /** Probe `config.appUrl` is reachable; throw if not. Run once before captures. */
  health(config: ProductConfig): Promise<void>;
  screenshot(req: ScreenshotRequest, config: ProductConfig): Promise<DriverResult>;
  clip(req: ClipRequest, config: ProductConfig): Promise<DriverResult>;
  close(): Promise<void>;
};

export const MIN_ASSET_BYTES = 8 * 1024; // a blank page screenshots to ~5 KB
