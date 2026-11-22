import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/**
 * Port for the owner's curated "top rated" selection. Today it is a JSON file; tomorrow it could be a
 * CMS or an admin screen backed by a database without changing the catalogue service.
 */
export interface FeaturedProductsProvider {
  getFeaturedProductIds(): Promise<string[]>;
}

const featuredFileSchema = z.object({
  productIds: z
    .array(z.union([z.string().min(1), z.number().int()]).transform(String))
    .min(1, 'at least one product id is required')
    .refine((ids) => new Set(ids).size === ids.length, 'product ids must be unique'),
});

export class StaticFeaturedProductsProvider implements FeaturedProductsProvider {
  constructor(private readonly ids: string[]) {}

  getFeaturedProductIds(): Promise<string[]> {
    return Promise.resolve([...this.ids]);
  }
}

/** Reads and validates the curated list once at startup, so a bad edit fails fast instead of at request time. */
export async function loadFeaturedProductsFile(path: string): Promise<StaticFeaturedProductsProvider> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new Error(`Could not read featured products file at "${path}"`, { cause });
  }
  const parsed = featuredFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid featured products file "${path}": ${parsed.error.issues[0]?.message}`);
  }
  return new StaticFeaturedProductsProvider(parsed.data.productIds);
}
