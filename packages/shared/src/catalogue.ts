/**
 * Catalogue DTOs returned by the API. These are *our* shapes, deliberately decoupled from any
 * upstream data source (e.g. Fake Store) so the source can change without touching the client.
 */

export interface Money {
  /** Amount in major units, e.g. 109.95 */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
}

export interface Category {
  /** URL-safe identifier, e.g. "mens-clothing" */
  slug: string;
  /** Display name, e.g. "Men's clothing" */
  name: string;
}

export interface Rating {
  average: number;
  count: number;
}

export interface Product {
  /** Opaque identifier; a string so future sources (SKUs, UUIDs) fit without a contract change */
  id: string;
  title: string;
  description: string;
  price: Money;
  category: Category;
  imageUrl: string;
  rating: Rating | null;
}

export interface ProductListResponse {
  products: Product[];
}

export interface CategoryListResponse {
  categories: Category[];
}

export interface CategoryProductsResponse {
  category: Category;
  topRated: Product[];
  others: Product[];
}

export interface SearchResponse {
  query: string;
  products: Product[];
}

export interface ProductResponse {
  product: Product;
}
