import type { Category, CategoryProductsResponse, Product } from '@catalogue/shared';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { FeaturedProductsProvider } from './FeaturedProducts';
import type { ProductRepository } from './ProductRepository';
import { MAX_SEARCH_LENGTH, byRatingDesc, tokenize } from './search';

export interface CatalogueServiceOptions {
  /** Minimum number of "top rated" products on a category page (curated first, then by rating). */
  categoryTopRatedLimit: number;
  onMissingFeaturedProduct?: (id: string) => void;
}

/** Business rules for browsing the catalogue. Knows nothing about HTTP or the upstream data source. */
export class CatalogueService {
  constructor(
    private readonly products: ProductRepository,
    private readonly featured: FeaturedProductsProvider,
    private readonly options: CatalogueServiceOptions,
  ) {}

  /** The owner's curated products, in curated order. Unknown IDs are skipped (and reported), not padded. */
  async getFeaturedProducts(): Promise<Product[]> {
    const [ids, all] = await Promise.all([
      this.featured.getFeaturedProductIds(),
      this.products.listProducts(),
    ]);
    const byId = new Map(all.map((p) => [p.id, p]));
    const result: Product[] = [];
    for (const id of ids) {
      const product = byId.get(id);
      if (product) result.push(product);
      else this.options.onMissingFeaturedProduct?.(id);
    }
    return result;
  }

  listCategories(): Promise<Category[]> {
    return this.products.listCategories();
  }

  /**
   * Splits a category into "top rated" and "others". Top rated = curated products in this category
   * (curated order), topped up with the highest-rated remaining products until the limit is reached.
   */
  async getCategoryProducts(slug: string): Promise<CategoryProductsResponse> {
    const categories = await this.products.listCategories();
    const category = categories.find((c) => c.slug === slug);
    if (!category) throw new NotFoundError(`Category "${slug}" was not found`);

    const [ids, products] = await Promise.all([
      this.featured.getFeaturedProductIds(),
      this.products.listProducts({ categorySlug: slug }),
    ]);

    const curated = ids
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined);
    const remaining = products.filter((p) => !curated.includes(p));
    const topUpCount = Math.max(0, this.options.categoryTopRatedLimit - curated.length);
    const topRated = [...curated, ...[...remaining].sort(byRatingDesc).slice(0, topUpCount)];
    const others = products.filter((p) => !topRated.includes(p));

    return { category, topRated, others };
  }

  async search(term: string): Promise<Product[]> {
    const trimmed = term.trim();
    if (tokenize(trimmed).length === 0) {
      throw new ValidationError('Enter a search term', { q: 'Enter a search term' });
    }
    if (trimmed.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError('Search term is too long', {
        q: `Search term must be at most ${MAX_SEARCH_LENGTH} characters`,
      });
    }
    return this.products.listProducts({ search: trimmed });
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.products.getProduct(id);
    if (!product) throw new NotFoundError(`Product "${id}" was not found`);
    return product;
  }
}
