import { parseProductConfig, parseStoryboard, type ProductConfig, type Storyboard } from "./schema";
import { productPaths, type ProductPaths } from "./paths";

export type LoadedProduct = {
  config: ProductConfig;
  storyboard: Storyboard;
  paths: ProductPaths;
};

/** Dynamically import a product's config + storyboard and validate both. */
export async function loadProduct(root: string, name: string, base = "products"): Promise<LoadedProduct> {
  const paths = productPaths(root, name, base);

  let configModule: { default?: unknown };
  let storyboardModule: { default?: unknown };
  try {
    configModule = await import(paths.config);
    storyboardModule = await import(paths.storyboard);
  } catch (cause) {
    throw new Error(`Could not load product "${name}" from ${paths.dir}: ${(cause as Error).message}`);
  }

  const config = parseProductConfig(configModule.default);
  const storyboard = parseStoryboard(storyboardModule.default);
  return { config, storyboard, paths };
}
