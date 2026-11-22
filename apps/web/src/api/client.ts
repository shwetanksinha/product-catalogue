import type {
  ApiErrorBody,
  CategoryListResponse,
  CategoryProductsResponse,
  EnquiryRequest,
  EnquiryResponse,
  ProductListResponse,
  ProductResponse,
  SearchResponse,
} from '@catalogue/shared';

/** All product data comes from our own API (same origin); the client never calls Fake Store directly. */
const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? 'UNKNOWN',
      body?.error.message ?? `Request failed (${response.status})`,
      body?.error.fields,
    );
  }
  return (await response.json()) as T;
}

export const api = {
  getFeaturedProducts: (signal?: AbortSignal) =>
    request<ProductListResponse>('/products/featured', { signal }),

  getCategories: (signal?: AbortSignal) => request<CategoryListResponse>('/categories', { signal }),

  getCategoryProducts: (slug: string, signal?: AbortSignal) =>
    request<CategoryProductsResponse>(`/categories/${encodeURIComponent(slug)}/products`, { signal }),

  search: (query: string, signal?: AbortSignal) =>
    request<SearchResponse>(`/search?${new URLSearchParams({ q: query })}`, { signal }),

  getProduct: (id: string, signal?: AbortSignal) =>
    request<ProductResponse>(`/products/${encodeURIComponent(id)}`, { signal }),

  submitEnquiry: (enquiry: EnquiryRequest) =>
    request<EnquiryResponse>('/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enquiry),
    }),
};
