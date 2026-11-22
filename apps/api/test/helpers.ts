import type { Category, Product } from '@catalogue/shared';
import type { ProductQuery, ProductRepository } from '../src/modules/catalogue/ProductRepository';
import { matchesSearch } from '../src/modules/catalogue/search';
import type { EmailMessage, EmailSender } from '../src/modules/enquiry/EmailSender';

export function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    title: `Product ${overrides.id}`,
    description: 'A product',
    price: { amount: 10, currency: 'USD' },
    category: { slug: 'electronics', name: 'Electronics' },
    imageUrl: `https://img.example/${overrides.id}.png`,
    rating: { average: 3, count: 10 },
    ...overrides,
  };
}

export const electronics: Category = { slug: 'electronics', name: 'Electronics' };
export const jewelery: Category = { slug: 'jewelery', name: 'Jewelery' };

/** In-memory ProductRepository: also demonstrates that a new data source is just another adapter. */
export class InMemoryProductRepository implements ProductRepository {
  calls = 0;
  constructor(
    private readonly products: Product[],
    private readonly categories: Category[] = [electronics, jewelery],
  ) {}

  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    this.calls++;
    return this.products.filter(
      (p) =>
        (!query.categorySlug || p.category.slug === query.categorySlug) &&
        (query.search === undefined || matchesSearch(p, query.search)),
    );
  }

  async getProduct(id: string): Promise<Product | null> {
    this.calls++;
    return this.products.find((p) => p.id === id) ?? null;
  }

  async listCategories(): Promise<Category[]> {
    this.calls++;
    return this.categories;
  }
}

export class RecordingEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  failWith: Error | null = null;

  async send(message: EmailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}
