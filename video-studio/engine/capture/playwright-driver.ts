import { chromium, type Browser, type Page } from "playwright";
import type { ProductConfig, Step } from "../schema";
import type { ClipRequest, DriverResult, PageDriver, ScreenshotRequest } from "./types";

const TITLECARD_HTML = (bg: string, text: string) =>
  `<!doctype html><html><body style="margin:0;background:${bg};color:#fff;font:80px sans-serif;display:grid;place-items:center;height:100vh"><div>${text}</div></body></html>`;

/** Options for runSteps. When smooth is true, clicks/scrolls animate like a real user. */
type RunStepsOpts = { smooth?: boolean };

/** Execute a sequence of interaction steps against a Playwright page. */
async function runSteps(page: Page, steps: Step[], opts: RunStepsOpts = {}): Promise<void> {
  const smooth = opts.smooth ?? false;
  for (const s of steps) {
    if (s.action === "click") {
      if (smooth) {
        const b = await page.locator(s.selector).first().boundingBox().catch(() => null);
        if (b) {
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
          await page.waitForTimeout(150);
        }
      }
      await page.click(s.selector);
    } else if (s.action === "hover") {
      if (smooth) {
        const b = await page.locator(s.selector).first().boundingBox().catch(() => null);
        if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
        await page.waitForTimeout(500);
      } else {
        await page.locator(s.selector).first().hover();
      }
    } else if (s.action === "type") {
      // page.fill is deliberate: atomic value set, reliable for controlled inputs vs keystroke simulation
      if (smooth) {
        await page.type(s.selector, s.text, { delay: 60 });
      } else {
        await page.fill(s.selector, s.text);
      }
    } else if (s.action === "scroll") {
      // When a selector is provided, scroll that element; otherwise scroll the window.
      if (s.selector) {
        if (typeof s.to === "number") {
          await page.locator(s.selector).hover();
          if (smooth) {
            const delta = s.to;
            for (let i = 0; i < 6; i++) {
              await page.mouse.wheel(0, delta / 6);
              await page.waitForTimeout(80);
            }
          } else {
            await page.mouse.wheel(0, s.to);
          }
        } else {
          await page.$eval(
            s.selector,
            (el, dir) => { el.scrollTo(0, dir === "bottom" ? el.scrollHeight : 0); },
            s.to as "bottom" | "top",
          );
        }
      } else if (typeof s.to === "number") {
        if (smooth) {
          const delta = s.to;
          for (let i = 0; i < 6; i++) {
            await page.mouse.wheel(0, delta / 6);
            await page.waitForTimeout(80);
          }
        } else {
          await page.mouse.wheel(0, s.to);
        }
      } else {
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
}

/** Init script that injects a visible cursor element into the page. */
const CURSOR_INIT_SCRIPT = () => {
  const ID = "__vs_cursor";
  const ensure = () => {
    if (document.getElementById(ID) || !document.body) return;
    const c = document.createElement("div");
    c.id = ID;
    c.style.cssText =
      "position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;width:24px;height:24px;" +
      "filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));transition:transform .05s linear";
    c.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24">' +
      '<path d="M4 2 L4 20 L9 15 L12.5 22 L15 21 L11.5 14 L18 14 Z" fill="#fff" stroke="#000" stroke-width="1"/>' +
      "</svg>";
    document.body.appendChild(c);
  };
  const move = (x: number, y: number, down = false) => {
    ensure();
    const c = document.getElementById(ID);
    if (c) c.style.transform = `translate(${x - 2}px, ${y - 2}px) scale(${down ? 0.8 : 1})`;
  };
  document.addEventListener("DOMContentLoaded", ensure, true);
  document.addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
  document.addEventListener("mousedown", (e) => move(e.clientX, e.clientY, true), true);
  document.addEventListener("mouseup", (e) => move(e.clientX, e.clientY, false), true);
};

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
          if (req.steps?.length) {
            // Non-smooth path for screenshots — keeps still captures fast/unchanged
            await runSteps(page, req.steps);
            await page.waitForTimeout(400);
          }
        }
        await page.screenshot({ path: req.outPath, type: "png", fullPage: false });
        const bytes = (await Bun.file(req.outPath).arrayBuffer()).byteLength;
        let focus: DriverResult["focus"];
        if (req.focusSelector) {
          const box = await page.locator(req.focusSelector).first().boundingBox().catch(() => null);
          if (box) focus = { x: box.x, y: box.y, w: box.width, h: box.height };
        }
        return { bytes, w: config.output.width, h: config.output.height, focus };
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
      // Inject visible cursor before any navigation so it is present on the first frame.
      await page.addInitScript(CURSOR_INIT_SCRIPT);
      if (config.prime) await config.prime(page);
      try {
        await page.goto(req.route, { waitUntil: "domcontentloaded", timeout: 15_000 });
        // Nudge the mouse to the centre so the cursor element appears immediately.
        await page.mouse.move(config.output.width / 2, config.output.height / 2, { steps: 5 });
        await settle(page, req.capture.waitFor);
        // Smooth path: animate mouse movements and type with visible keystrokes.
        await runSteps(page, req.capture.steps, { smooth: true });
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
