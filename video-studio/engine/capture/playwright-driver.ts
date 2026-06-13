import { chromium, type Browser, type Page } from "playwright";
import type { ProductConfig } from "../schema";
import type { ClipRequest, DriverResult, PageDriver, ScreenshotRequest } from "./types";

const TITLECARD_HTML = (bg: string, text: string) =>
  `<!doctype html><html><body style="margin:0;background:${bg};color:#fff;font:80px sans-serif;display:grid;place-items:center;height:100vh"><div>${text}</div></body></html>`;

export function createPlaywrightDriver(): PageDriver {
  let browser: Browser | null = null;

  async function newPage(config: ProductConfig): Promise<Page> {
    if (!browser) browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: config.output.width, height: config.output.height },
      deviceScaleFactor: 2,
      recordVideo: undefined,
    });
    const page = await context.newPage();
    if (config.prime) await config.prime(page);
    return page;
  }

  async function settle(page: Page, waitFor?: string): Promise<void> {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 10_000 });
    await page.waitForTimeout(600);
  }

  function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }

  return {
    async health(config) {
      const page = await newPage(config);
      try {
        const res = await page.goto(config.appUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
        if (!res || !res.ok()) {
          throw new Error(`app not healthy at ${config.appUrl} (status ${res?.status() ?? "none"})`);
        }
      } finally {
        await page.context().close();
      }
    },

    async screenshot(req: ScreenshotRequest, config): Promise<DriverResult> {
      const page = await newPage(config);
      try {
        if (req.kind === "titlecard") {
          const cap = req.capture as { kind: "titlecard"; bg?: string };
          const bg = cap.bg ?? config.theme.palette.bg;
          await page.setContent(TITLECARD_HTML(bg, ""), { waitUntil: "networkidle" });
        } else {
          const res = await page.goto(req.route!, { waitUntil: "domcontentloaded", timeout: 15_000 });
          if (res) {
            const finalUrl = normalizeUrl(res.url());
            const expectedUrl = normalizeUrl(req.route!);
            if (finalUrl !== expectedUrl) {
              throw new Error(`redirected to ${res.url()} (role/auth not primed?)`);
            }
          }
          await settle(page, req.waitFor);
        }
        await page.screenshot({ path: req.outPath, type: "png", fullPage: false });
        const bytes = (await Bun.file(req.outPath).arrayBuffer()).byteLength;
        return { bytes, w: config.output.width, h: config.output.height };
      } finally {
        await page.context().close();
      }
    },

    async clip(req: ClipRequest, config): Promise<DriverResult> {
      if (!browser) browser = await chromium.launch();
      const context = await browser.newContext({
        viewport: { width: config.output.width, height: config.output.height },
        deviceScaleFactor: 1,
        recordVideo: {
          dir: req.outPath + ".dir",
          size: { width: config.output.width, height: config.output.height },
        },
      });
      const page = await context.newPage();
      if (config.prime) await config.prime(page);
      try {
        await page.goto(req.route, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await settle(page, req.capture.waitFor);
        for (const s of req.capture.steps) {
          if (s.action === "click") await page.click(s.selector);
          else if (s.action === "type") await page.fill(s.selector, s.text);
          else if (s.action === "scroll") {
            if (typeof s.to === "number") await page.mouse.wheel(0, s.to);
            else {
              await page.evaluate(
                (dir) => window.scrollTo(0, dir === "bottom" ? document.body.scrollHeight : 0),
                s.to,
              );
            }
          } else if (s.action === "wait") {
            if (typeof s.for === "number") await page.waitForTimeout(s.for);
            else await page.waitForSelector(s.for, { timeout: 10_000 });
          }
        }
        await page.waitForTimeout(400);
        const video = page.video();
        if (!video) throw new Error("video recording not started — recordVideo option not set");
        await context.close(); // finalizes the video file
        const tmp = await video.path();
        await Bun.write(req.outPath, Bun.file(tmp));
        const bytes = (await Bun.file(req.outPath).arrayBuffer()).byteLength;
        return { bytes, w: config.output.width, h: config.output.height };
      } catch (cause) {
        await context.close().catch(() => {});
        throw cause;
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
