import { useFeaturedProducts } from '../api/hooks';
import { ProductGrid } from '../components/ProductTile';
import { ErrorState, Loading } from '../components/Status';

export function HomePage() {
  const { data, error, isPending } = useFeaturedProducts();

  return (
    <section aria-labelledby="featured-heading">
      <h1 id="featured-heading">Top rated</h1>
      <p className="muted">Our hand-picked favourites.</p>
      {isPending ? (
        <Loading label="Loading featured products…" />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <ProductGrid products={data.products} label="Top rated products" />
      )}
    </section>
  );
}
