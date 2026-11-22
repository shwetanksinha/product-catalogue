import type { Product } from '@catalogue/shared';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App, createQueryClient } from '../App';

export function makeProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Description ${id}`,
    price: { amount: 10 + Number(id), currency: 'USD' },
    category: { slug: 'electronics', name: 'Electronics' },
    imageUrl: `https://img.example/${id}.png`,
    rating: { average: 4, count: 10 },
    ...overrides,
  };
}

type Handler = (init: RequestInit | undefined) => { status?: number; body: unknown };

/**
 * Stubs global fetch with a table of `METHOD /path?query` → response. Unmatched requests fail the test,
 * and every requested URL is recorded so tests can assert the browser only talks to our API.
 */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const requests: { method: string; url: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ method, url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    const key = `${method} ${url}`;
    if (!(key in routes)) throw new Error(`Unexpected request: ${key}`);
    const route = routes[key];
    const { status = 200, body } = typeof route === 'function' ? (route as Handler)(init) : { body: route };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests };
}

export function renderApp(path: string) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App queryClient={queryClient} />
    </MemoryRouter>,
  );
}

export const categoriesResponse = {
  categories: [
    { slug: 'electronics', name: 'Electronics' },
    { slug: 'jewelery', name: 'Jewelery' },
  ],
};
