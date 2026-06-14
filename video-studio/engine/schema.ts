import { z } from "zod";

export const localizedText = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1).optional(),
});

export const step = z.discriminatedUnion("action", [
  z.object({ action: z.literal("click"), selector: z.string() }),
  z.object({ action: z.literal("type"), selector: z.string(), text: z.string() }),
  z.object({
    action: z.literal("scroll"),
    selector: z.string().optional(),
    to: z.union([z.literal("bottom"), z.literal("top"), z.number()]),
  }),
  z.object({ action: z.literal("wait"), for: z.union([z.string(), z.number()]) }),
]);

export const capture = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("screenshot"), route: z.string(), waitFor: z.string().optional(), steps: z.array(step).optional() }),
  z.object({
    kind: z.literal("interaction"),
    route: z.string(),
    steps: z.array(step).min(1),
    waitFor: z.string().optional(),
  }),
  z.object({ kind: z.literal("titlecard"), bg: z.string().optional(), logo: z.boolean().optional() }),
]);

export const scene = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "id must be lower-kebab-case"),
    capture,
    caption: localizedText.optional(),
    narration: z.string().min(1).optional(),
    duration: z.union([z.number().positive(), z.literal("auto")]),
    motion: z.enum(["kenburns", "none"]).optional(),
    transitionOut: z.enum(["cut", "fade", "slide"]).optional(),
    focus: z.object({ selector: z.string(), label: z.string().optional() }).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.duration === "auto" && !s.narration) {
      ctx.addIssue({
        code: "custom",
        path: ["narration"],
        message: "duration 'auto' requires narration (nothing to fit to)",
      });
    }
  });

export const storyboard = z.object({
  scenes: z.array(scene).min(1),
  defaults: z
    .object({
      transitionOut: z.enum(["cut", "fade", "slide"]).optional(),
      motion: z.enum(["kenburns", "none"]).optional(),
      duration: z.number().positive().optional(),
    })
    .optional(),
});

export const productConfig = z.object({
  appUrl: z.string().url(),
  theme: z.object({
    palette: z.object({ bg: z.string(), fg: z.string(), accent: z.string() }),
    fonts: z.object({ heading: z.string(), body: z.string() }),
    direction: z.enum(["rtl", "ltr"]),
    logo: z.string().optional(),
  }),
  output: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
  locale: z.object({ primary: z.string(), secondary: z.string().optional() }),
  voice: z.object({ id: z.string(), modelId: z.string().optional() }).optional(),
});

export type LocalizedText = z.infer<typeof localizedText>;
export type Step = z.infer<typeof step>;
export type Capture = z.infer<typeof capture>;
export type Scene = z.infer<typeof scene>;
export type Focus = NonNullable<Scene["focus"]>;
export type Storyboard = z.infer<typeof storyboard>;
export type ProductConfigData = z.infer<typeof productConfig>;

/** Hooks live alongside the validated data in a product.config.ts default export. */
export type ProductConfig = ProductConfigData & {
  prime?: (page: unknown) => void | Promise<void>;
  resolveRoute?: (route: string) => string | Promise<string>;
};

export function parseStoryboard(input: unknown): Storyboard {
  return storyboard.parse(input);
}

/** Validates the data fields, then returns the ORIGINAL object so function hooks survive. */
export function parseProductConfig(input: unknown): ProductConfig {
  productConfig.parse(input);
  return input as ProductConfig;
}
