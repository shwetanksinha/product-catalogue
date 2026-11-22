import { describe, expect, it, vi } from 'vitest';
import { FakeStoreProductRepository } from '../src/modules/catalogue/FakeStoreProductRepository';
import { UpstreamError } from '../src/shared/errors';

const rawProducts = [
  {
    id: 3,
    title: 'Mens Cotton Jacket',
    price: 55.99,
    description: 'Great outerwear jackets',
    category: "men's clothing",
    image: 'https://fakestoreapi.com/img/3.jpg',
    rating: { rate: 4.7, count: 500 },
  },
  {
    id: 9,
    title: 'WD 2TB Elements Portable External Hard Drive',
    price: 64,
    description: 'USB 3.0 and USB 2.0 compatibility',
    category: 'electronics',
    image: 'https://fakestoreapi.com/img/9.jpg',
    rating: { rate: 3.3, count: 203 },
  },
];

function respond(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

function repoWith(fetchImpl: typeof fetch) {
  return new FakeStoreProductRepository({ baseUrl: 'https://fake.test', timeoutMs: 1000, fetch: fetchImpl });
}

describe('FakeStoreProductRepository', () => {
  it('maps upstream products onto our domain model', async () => {
    const repo = repoWith(async () => respond(JSON.stringify(rawProducts)));
    const [jacket] = await repo.listProducts();
    expect(jacket).toEqual({
      id: '3',
      title: 'Mens Cotton Jacket',
      description: 'Great outerwear jackets',
      price: { amount: 55.99, currency: 'USD' },
      category: { slug: 'mens-clothing', name: "Men's clothing" },
      imageUrl: 'https://fakestoreapi.com/img/3.jpg',
      rating: { average: 4.7, count: 500 },
    });
  });

  it('filters by category slug and search term', async () => {
    const repo = repoWith(async () => respond(JSON.stringify(rawProducts)));
    expect((await repo.listProducts({ categorySlug: 'electronics' })).map((p) => p.id)).toEqual(['9']);
    expect((await repo.listProducts({ search: 'JACKET' })).map((p) => p.id)).toEqual(['3']);
  });

  it('maps categories to slug + display name', async () => {
    const repo = repoWith(async () => respond(JSON.stringify(['electronics', "men's clothing"])));
    expect(await repo.listCategories()).toEqual([
      { slug: 'electronics', name: 'Electronics' },
      { slug: 'mens-clothing', name: "Men's clothing" },
    ]);
  });

  it('treats the empty 200 body Fake Store returns for unknown ids as not found', async () => {
    const repo = repoWith(async () => respond(''));
    expect(await repo.getProduct('999')).toBeNull();
  });

  it('never sends non-numeric ids upstream', async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    const repo = repoWith(fetchSpy);
    expect(await repo.getProduct('../users')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['an HTTP error', async () => respond('oops', 503)],
    ['a network failure', async () => Promise.reject(new TypeError('fetch failed'))],
    ['an unexpected payload', async () => respond(JSON.stringify([{ id: 'x' }]))],
    ['invalid JSON', async () => respond('<html>')],
  ])('raises UpstreamError on %s', async (_label, impl) => {
    const repo = repoWith(impl as typeof fetch);
    await expect(repo.listProducts()).rejects.toBeInstanceOf(UpstreamError);
  });
});
