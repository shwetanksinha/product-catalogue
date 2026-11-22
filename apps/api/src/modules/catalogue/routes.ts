import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type {
  CategoryListResponse,
  CategoryProductsResponse,
  ProductListResponse,
  ProductResponse,
  SearchResponse,
} from '@catalogue/shared';
import { toValidationError } from '../../shared/validation';
import type { CatalogueService } from './CatalogueService';

const searchQuerySchema = z.object({ q: z.string().default('') });
const idParamsSchema = z.object({ id: z.string() });
const slugParamsSchema = z.object({ slug: z.string() });

/** Catalogue data changes rarely; let browsers/CDNs reuse responses briefly. */
function cacheable(reply: FastifyReply): void {
  reply.header('cache-control', 'public, max-age=60');
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw toValidationError(result.error);
  return result.data;
}

export function catalogueRoutes(service: CatalogueService) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/products/featured', async (_req, reply): Promise<ProductListResponse> => {
      cacheable(reply);
      return { products: await service.getFeaturedProducts() };
    });

    app.get('/products/:id', async (req, reply): Promise<ProductResponse> => {
      const { id } = parse(idParamsSchema, req.params);
      cacheable(reply);
      return { product: await service.getProduct(id) };
    });

    app.get('/categories', async (_req, reply): Promise<CategoryListResponse> => {
      cacheable(reply);
      return { categories: await service.listCategories() };
    });

    app.get('/categories/:slug/products', async (req, reply): Promise<CategoryProductsResponse> => {
      const { slug } = parse(slugParamsSchema, req.params);
      cacheable(reply);
      return service.getCategoryProducts(slug);
    });

    app.get('/search', async (req, reply): Promise<SearchResponse> => {
      const { q } = parse(searchQuerySchema, req.query);
      const products = await service.search(q);
      cacheable(reply);
      return { query: q.trim(), products };
    });
  };
}
