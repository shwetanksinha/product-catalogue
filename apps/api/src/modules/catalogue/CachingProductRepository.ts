import type { Category, Product } from '@catalogue/shared';
import type { ProductQuery, ProductRepository } from './ProductRepository';

interface Entry {
  expiresAt: number;
  value: Promise<unknown>;
}

export interface CacheOptions {
  ttlMs: number;
  /** Upper bound on cached keys; search terms are user-controlled, so the cache must not grow unbounded. */
  maxEntries?: number;
  now?: () => number;
}

/**
 * Decorator that adds a TTL cache in front of any ProductRepository. In-flight requests are shared,
 * and failures are evicted immediately so a transient upstream error is not cached.
 */
export class CachingProductRepository implements ProductRepository {
  private readonly cache = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: ProductRepository,
    private readonly options: CacheOptions,
  ) {
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  listProducts(query: ProductQuery = {}): Promise<Product[]> {
    const key = `list:${query.categorySlug ?? ''}:${query.search?.trim().toLowerCase() ?? ''}`;
    return this.cached(key, () => this.inner.listProducts(query));
  }

  getProduct(id: string): Promise<Product | null> {
    return this.cached(`product:${id}`, () => this.inner.getProduct(id));
  }

  listCategories(): Promise<Category[]> {
    return this.cached('categories', () => this.inner.listCategories());
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.options.ttlMs <= 0) return load();

    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value as Promise<T>;

    const value = load();
    this.cache.delete(key);
    this.cache.set(key, { expiresAt: this.now() + this.options.ttlMs, value });
    this.evictOverflow();
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key);
    });
    return value;
  }

  private evictOverflow(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) return;
      this.cache.delete(oldestKey);
    }
  }
}
