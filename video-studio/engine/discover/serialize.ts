import type { Storyboard } from "../schema";

/**
 * Serializes a Storyboard to the source text of a `storyboard.ts` file.
 *
 * The generated file:
 * - Imports Storyboard type from "../../engine/schema" (relative to products/<name>/).
 * - Declares `const storyboard: Storyboard = <json>;`.
 * - Exports it as the default export.
 */
export function serializeStoryboard(storyboard: Storyboard): string {
  const json = JSON.stringify(storyboard, null, 2);
  return (
    `import type { Storyboard } from "../../engine/schema";\n` +
    `\nconst storyboard: Storyboard = ${json};\n` +
    `\nexport default storyboard;\n`
  );
}
