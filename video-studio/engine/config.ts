import { parseProductConfig, parseStoryboard, type ProductConfig, type Storyboard } from "./schema";
import { productPaths, type ProductPaths } from "./paths";

export type LoadedProduct = {
  config: ProductConfig;
  storyboard: Storyboard;
  paths: ProductPaths;
};

export type LoadedConfig = { config: ProductConfig; paths: ProductPaths };

/** Load + validate ONLY product.config.ts (no storyboard required). For discovery. */
export async function loadProductConfig(root: string, name: string, base = "products"): Promise<LoadedConfig> {
  const paths = productPaths(root, name, base);
  let mod: { default?: unknown };
  try {
    mod = await import(paths.config);
  } catch (cause) {
    throw new Error(`Could not load config for product "${name}" from ${paths.dir}: ${(cause as Error).message}`);
  }
  return { config: parseProductConfig(mod.default), paths };
}

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
