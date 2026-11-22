import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from './client';

export const queryKeys = {
  featured: ['products', 'featured'] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['categories', slug, 'products'] as const,
  search: (q: string) => ['search', q] as const,
  product: (id: string) => ['products', id] as const,
};

export const useFeaturedProducts = () =>
  useQuery({ queryKey: queryKeys.featured, queryFn: ({ signal }) => api.getFeaturedProducts(signal) });

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: ({ signal }) => api.getCategories(signal) });

export const useCategoryProducts = (slug: string) =>
  useQuery({
    queryKey: queryKeys.category(slug),
    queryFn: ({ signal }) => api.getCategoryProducts(slug, signal),
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.search(q),
    queryFn: ({ signal }) => api.search(q, signal),
    enabled: q.trim().length > 0,
  });

export const useProduct = (id: string) =>
  useQuery({ queryKey: queryKeys.product(id), queryFn: ({ signal }) => api.getProduct(id, signal) });

export const useSubmitEnquiry = () => useMutation({ mutationFn: api.submitEnquiry });

/** Client errors (4xx) won't fix themselves, so only retry network/server failures. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}
