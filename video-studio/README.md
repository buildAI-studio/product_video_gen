# Video Studio

Turn any running web app into a narrated demo video. A product-agnostic engine plus one
config folder per product.

## Onboard a product

```bash
cd video-studio
bun install
bunx playwright install chromium       # one time
bun run video init <name>              # scaffolds products/<name>/
# edit products/<name>/product.config.ts and storyboard.ts
export ELEVENLABS_API_KEY=...          # required for the narrate stage
bun run video <name>                   # capture -> narrate -> render
```

## Stages

- `bun run video <name> --only capture`  — Playwright screenshots/clips -> `manifests/capture.json`
- `bun run video <name> --only narrate`  — ElevenLabs TTS -> `manifests/audio.json`
- `bun run video <name> --only render`   — Remotion -> `out/<name>.mp4` (offline; no browser/network)
- `--from <stage>` runs that stage onward; `--preview` opens Remotion Studio.

`render` consumes only the manifests, so iterate on timing/captions without re-capturing.

## Layout

- `engine/` — shared pipeline. Never edit it to onboard a product.
- `products/<name>/` — `product.config.ts` (app URL, theme, locale, voice) + `storyboard.ts` (scenes).

## How it works

Three isolated stages communicate through JSON manifests on disk:

1. **capture** — boots/probes the app, primes locale/theme/role, screenshots each scene (or
   records scripted interaction clips); writes `manifests/capture.json`.
2. **narrate** — synthesizes ElevenLabs voiceover per scene and measures exact durations
   (scenes with `duration: "auto"` fit to their audio); writes `manifests/audio.json`.
3. **render** — a Remotion composition maps the schedule to `<TransitionSeries>` with
   Ken-Burns stills, themed captions, and per-scene audio; renders the final mp4.

## Known limitations

- **No incremental caching yet.** Each run re-captures and re-synthesizes every scene
  (narration re-bills ElevenLabs). Per-scene hash-based skipping is a planned follow-up;
  the manifests already store a `hash` per scene for it.
- **Title cards** render as a themed background plus caption; the storyboard's
  `titlecard.logo` option is not drawn yet.
- **`prime` hook** is typed `(page: unknown)`; cast to Playwright's `Page` in your
  product config (kept untyped to keep the schema module browser-safe).
