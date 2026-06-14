import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadProduct, type LoadedProduct } from "./config";
import { readAudioManifest, readCaptureManifest, writeAudioManifest, writeCaptureManifest } from "./manifest";
import { runCapture } from "./capture/capture";
import { createPlaywrightDriver } from "./capture/playwright-driver";
import { runNarrate } from "./narrate/narrate";
import { createElevenLabsProvider } from "./narrate/elevenlabs";
import { computeSchedule } from "./render/schedule";
import { parseArgs, stagesToRun } from "./stages";

const ROOT = import.meta.dir.replace(/\/engine$/, "");

/** Build the Remotion inputProps from the product + its written manifests. */
async function buildInputProps(product: LoadedProduct) {
  const capture = await readCaptureManifest(product.paths.captureManifest);
  const audio = await readAudioManifest(product.paths.audioManifest);
  if (!capture) throw new Error("no capture.json — run the capture stage first");
  if (!audio) throw new Error("no audio.json — run the narrate stage first");
  const schedule = computeSchedule(product.storyboard, capture, audio, product.config.output.fps);
  return {
    schedule,
    theme: product.config.theme,
    locale: product.config.locale,
    fps: product.config.output.fps,
    width: product.config.output.width,
    height: product.config.output.height,
  };
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  if (!args.product) {
    console.error(
      "usage: video <product> [--only capture|narrate|render] [--from <stage>] [--force] [--preview]\n       video init <product>",
    );
    process.exit(1);
  }

  if (args.command === "init") {
    await scaffold(args.product);
    return;
  }

  const product = await loadProduct(ROOT, args.product, args.base);

  if (args.preview) {
    const props = await buildInputProps(product);
    const propsPath = join(product.paths.dir, "preview-props.json");
    await Bun.write(propsPath, JSON.stringify(props));
    console.log(`▶ launching Remotion Studio for ${args.product}`);
    const proc = Bun.spawn(["bunx", "remotion", "studio", "engine/index.ts", "--props", propsPath], {
      cwd: ROOT,
      stdio: ["inherit", "inherit", "inherit"],
    });
    await proc.exited;
    return;
  }

  const stages = stagesToRun(args);
  console.log(`▶ ${args.product}: ${stages.join(" → ")}`);

  if (stages.includes("capture")) {
    console.log("• capture");
    const prior = await readCaptureManifest(product.paths.captureManifest);
    const m = await runCapture({
      storyboard: product.storyboard,
      config: product.config,
      driver: createPlaywrightDriver(),
      assetsDir: product.paths.assets,
      productDir: product.paths.dir,
      prior,
      force: args.force,
    });
    await writeCaptureManifest(product.paths.captureManifest, m);
    const failed = m.scenes.filter((s) => !s.ok).map((s) => s.id);
    if (failed.length) throw new Error(`capture failed for: ${failed.join(", ")}`);
  }

  if (stages.includes("narrate")) {
    console.log("• narrate");
    const prior = await readAudioManifest(product.paths.audioManifest);
    const provider = createElevenLabsProvider({ apiKey: process.env.ELEVENLABS_API_KEY ?? "" });
    const m = await runNarrate({
      storyboard: product.storyboard,
      config: product.config,
      provider,
      audioDir: product.paths.audio,
      productDir: product.paths.dir,
      prior,
      force: args.force,
    });
    await writeAudioManifest(product.paths.audioManifest, m);
  }

  if (stages.includes("render")) {
    console.log("• render");
    const inputProps = await buildInputProps(product);
    await mkdir(product.paths.out, { recursive: true });
    const serveUrl = await bundle({ entryPoint: join(ROOT, "engine", "index.ts"), publicDir: product.paths.dir, onProgress: () => {} });
    const composition = await selectComposition({ serveUrl, id: "ProductVideo", inputProps });
    const outPath = join(product.paths.out, `${args.product}.mp4`);
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: outPath, inputProps });
    console.log(`✓ rendered ${outPath}`);
  }
}

async function scaffold(name: string) {
  const dir = join(ROOT, "products", name);
  await mkdir(dir, { recursive: true });
  const config = `import type { ProductConfig } from "../../engine/schema";

const config: ProductConfig = {
  appUrl: "http://localhost:3000",
  theme: {
    palette: { bg: "#0d110d", fg: "#ffffff", accent: "#c8a45c" },
    fonts: { heading: "Arial", body: "Arial" },
    direction: "ltr",
  },
  output: { width: 1920, height: 1080, fps: 30 },
  locale: { primary: "en" },
  voice: { id: "REPLACE_WITH_ELEVENLABS_VOICE_ID" },
};

export default config;
`;
  const storyboard = `import type { Storyboard } from "../../engine/schema";

const storyboard: Storyboard = {
  scenes: [
    { id: "01-title", capture: { kind: "titlecard" }, caption: { primary: "${name}" }, narration: "Welcome to ${name}.", duration: "auto", transitionOut: "fade" },
  ],
};

export default storyboard;
`;
  await Bun.write(join(dir, "product.config.ts"), config);
  await Bun.write(join(dir, "storyboard.ts"), storyboard);
  console.log(`✓ scaffolded products/${name}/ (edit product.config.ts + storyboard.ts, then: bun run video ${name})`);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
