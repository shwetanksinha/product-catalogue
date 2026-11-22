import { describe, expect, it, vi } from 'vitest';
import { CatalogueService } from '../src/modules/catalogue/CatalogueService';
import { StaticFeaturedProductsProvider } from '../src/modules/catalogue/FeaturedProducts';
import { InMemoryProductRepository, jewelery, makeProduct } from './helpers';

const products = [
  makeProduct({ id: '1', title: 'Gaming Monitor', rating: { average: 4.0, count: 5 } }),
  makeProduct({ id: '2', title: 'Portable SSD', rating: { average: 4.8, count: 5 } }),
  makeProduct({ id: '3', title: 'USB Cable', rating: { average: 2.0, count: 5 } }),
  makeProduct({ id: '4', title: 'Hard Drive', rating: null }),
  makeProduct({ id: '5', title: 'Webcam', rating: { average: 4.5, count: 5 } }),
  makeProduct({ id: '10', title: 'Gold Ring', category: jewelery, description: 'Shiny gold' }),
];

function service(featuredIds: string[], limit = 3, onMissing = vi.fn()) {
  return new CatalogueService(
    new InMemoryProductRepository(products),
    new StaticFeaturedProductsProvider(featuredIds),
    { categoryTopRatedLimit: limit, onMissingFeaturedProduct: onMissing },
  );
}

describe('CatalogueService.getFeaturedProducts', () => {
  it('returns exactly the curated products, in curated order', async () => {
    const result = await service(['5', '10', '1', '3', '2']).getFeaturedProducts();
    expect(result.map((p) => p.id)).toEqual(['5', '10', '1', '3', '2']);
  });

  it('skips and reports curated ids that no longer exist instead of padding', async () => {
    const onMissing = vi.fn();
    const result = await service(['2', '999'], 3, onMissing).getFeaturedProducts();
    expect(result.map((p) => p.id)).toEqual(['2']);
    expect(onMissing).toHaveBeenCalledWith('999');
  });
});

describe('CatalogueService.getCategoryProducts', () => {
  it('puts curated products first, tops up by rating, and lists the rest as others', async () => {
    const result = await service(['3', '10']).getCategoryProducts('electronics');
    expect(result.category.slug).toBe('electronics');
    // '3' is curated (despite a low rating); top-up picks the two highest-rated remaining.
    expect(result.topRated.map((p) => p.id)).toEqual(['3', '2', '5']);
    expect(result.others.map((p) => p.id)).toEqual(['1', '4']);
  });

  it('never duplicates a product across sections and covers the whole category', async () => {
    const result = await service([]).getCategoryProducts('electronics');
    const ids = [...result.topRated, ...result.others].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('throws NotFound for an unknown category', async () => {
    await expect(service([]).getCategoryProducts('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('CatalogueService.search', () => {
  it('matches case-insensitively across title, description and category', async () => {
    expect((await service([]).search('SSD')).map((p) => p.id)).toEqual(['2']);
    expect((await service([]).search('shiny')).map((p) => p.id)).toEqual(['10']);
    expect((await service([]).search('jewelery')).map((p) => p.id)).toEqual(['10']);
  });

  it('requires every word to match', async () => {
    expect((await service([]).search('gaming monitor')).map((p) => p.id)).toEqual(['1']);
    expect(await service([]).search('gaming ring')).toEqual([]);
  });

  it('rejects blank and overly long terms', async () => {
    await expect(service([]).search('   ')).rejects.toMatchObject({ statusCode: 400 });
    await expect(service([]).search('x'.repeat(101))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CatalogueService.getProduct', () => {
  it('throws NotFound when the product does not exist', async () => {
    await expect(service([]).getProduct('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
