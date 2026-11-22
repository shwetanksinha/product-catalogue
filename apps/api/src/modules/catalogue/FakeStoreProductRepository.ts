import { z } from 'zod';
import type { Category, Product } from '@catalogue/shared';
import { UpstreamError } from '../../shared/errors';
import type { ProductQuery, ProductRepository } from './ProductRepository';
import { matchesSearch } from './search';

const fakeStoreProductSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  rating: z.object({ rate: z.number(), count: z.number() }).optional(),
});
type FakeStoreProduct = z.infer<typeof fakeStoreProductSchema>;

export function toCategory(name: string): Category {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { slug, name: name.charAt(0).toUpperCase() + name.slice(1) };
}

export function toProduct(raw: FakeStoreProduct): Product {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description,
    price: { amount: raw.price, currency: 'USD' },
    category: toCategory(raw.category),
    imageUrl: raw.image,
    rating: raw.rating ? { average: raw.rating.rate, count: raw.rating.count } : null,
  };
}

export interface FakeStoreOptions {
  baseUrl: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

/**
 * Adapter for https://fakestoreapi.com. Fake Store has no search and only ~20 products, so filtering
 * happens in memory over the full list. Upstream payloads are validated so a contract change surfaces
 * as a clear 502 rather than broken data in the UI.
 */
export class FakeStoreProductRepository implements ProductRepository {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: FakeStoreOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    const raw = await this.getJson('/products');
    const parsed = z.array(fakeStoreProductSchema).safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Product source returned an unexpected payload');

    let products = parsed.data.map(toProduct);
    if (query.categorySlug) products = products.filter((p) => p.category.slug === query.categorySlug);
    const search = query.search;
    if (search !== undefined) products = products.filter((p) => matchesSearch(p, search));
    return products;
  }

  async getProduct(id: string): Promise<Product | null> {
    // Fake Store IDs are integers; anything else cannot exist and must never reach the upstream URL.
    if (!/^\d{1,10}$/.test(id)) return null;
    const raw = await this.getJson(`/products/${id}`);
    // Fake Store answers unknown IDs with 200 and an empty body.
    if (raw === null) return null;
    const parsed = fakeStoreProductSchema.safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Product source returned an unexpected payload');
    return toProduct(parsed.data);
  }

  async listCategories(): Promise<Category[]> {
    const raw = await this.getJson('/products/categories');
    const parsed = z.array(z.string()).safeParse(raw);
    if (!parsed.success) throw new UpstreamError('Product source returned an unexpected payload');
    return parsed.data.map(toCategory);
  }

  private async getJson(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (cause) {
      throw new UpstreamError('Product source is unreachable', { cause });
    }
    if (!response.ok) {
      throw new UpstreamError(`Product source responded with HTTP ${response.status}`);
    }
    const text = await response.text();
    if (text.trim() === '') return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw new UpstreamError('Product source returned invalid JSON', { cause });
    }
  }
}
