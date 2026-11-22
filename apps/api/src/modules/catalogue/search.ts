import type { Product } from '@catalogue/shared';

export const MAX_SEARCH_LENGTH = 100;

export function tokenize(term: string): string[] {
  return term.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Reference search rule: case-insensitive, every whitespace-separated token must appear somewhere in
 * the product's title, description or category name ("mens jacket" matches "Mens Cotton Jacket").
 */
export function matchesSearch(product: Product, term: string): boolean {
  const tokens = tokenize(term);
  if (tokens.length === 0) return false;
  const haystack = [product.title, product.description, product.category.name].join(' ').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Rating descending; unrated products sort last. Stable for equal ratings. */
export function byRatingDesc(a: Product, b: Product): number {
  return (b.rating?.average ?? -1) - (a.rating?.average ?? -1);
}
