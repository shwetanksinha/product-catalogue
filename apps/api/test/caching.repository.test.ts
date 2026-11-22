import { describe, expect, it } from 'vitest';
import { CachingProductRepository } from '../src/modules/catalogue/CachingProductRepository';
import type { ProductRepository } from '../src/modules/catalogue/ProductRepository';
import { InMemoryProductRepository, makeProduct } from './helpers';

function setup(maxEntries?: number) {
  let now = 0;
  const inner = new InMemoryProductRepository([makeProduct({ id: '1' })]);
  const cache = new CachingProductRepository(inner, {
    ttlMs: 1000,
    now: () => now,
    ...(maxEntries ? { maxEntries } : {}),
  });
  return { inner, cache, advance: (ms: number) => (now += ms) };
}

describe('CachingProductRepository', () => {
  it('serves repeat calls from cache until the TTL expires', async () => {
    const { inner, cache, advance } = setup();
    await cache.listProducts();
    await cache.listProducts();
    expect(inner.calls).toBe(1);

    advance(1001);
    await cache.listProducts();
    expect(inner.calls).toBe(2);
  });

  it('caches per query', async () => {
    const { inner, cache } = setup();
    await cache.listProducts({ search: 'a' });
    await cache.listProducts({ search: 'A ' });
    await cache.listProducts({ search: 'b' });
    expect(inner.calls).toBe(2);
  });

  it('does not cache failures', async () => {
    let calls = 0;
    const flaky: ProductRepository = {
      listProducts: async () => {
        calls++;
        if (calls === 1) throw new Error('upstream down');
        return [];
      },
      getProduct: async () => null,
      listCategories: async () => [],
    };
    const cache = new CachingProductRepository(flaky, { ttlMs: 1000 });
    await expect(cache.listProducts()).rejects.toThrow('upstream down');
    await expect(cache.listProducts()).resolves.toEqual([]);
  });

  it('evicts the oldest entries beyond maxEntries', async () => {
    const { inner, cache } = setup(2);
    await cache.listProducts({ search: 'a' });
    await cache.listProducts({ search: 'b' });
    await cache.listProducts({ search: 'c' });
    await cache.listProducts({ search: 'a' });
    expect(inner.calls).toBe(4);
  });
});
