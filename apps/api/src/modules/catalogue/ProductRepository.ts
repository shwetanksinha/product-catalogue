import type { Category, Product } from '@catalogue/shared';

export interface ProductQuery {
  categorySlug?: string;
  /** Free-text search; implementations decide how to match (see `matchesSearch` for the reference rule). */
  search?: string;
}

/**
 * Port for the product data source. The rest of the app only depends on this interface, so swapping
 * Fake Store for a database, PIM or search service means writing a new adapter, not changing callers.
 */
export interface ProductRepository {
  listProducts(query?: ProductQuery): Promise<Product[]>;
  /** Resolves to null when the product does not exist. */
  getProduct(id: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
}
