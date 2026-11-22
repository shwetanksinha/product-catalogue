import { useSearchParams } from 'react-router';
import { useSearch } from '../api/hooks';
import { ProductGrid } from '../components/ProductTile';
import { ErrorState, Loading } from '../components/Status';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { data, error, isPending } = useSearch(q);

  if (!q) {
    return (
      <>
        <h1>Search</h1>
        <p className="muted">Enter a search term above and press Search.</p>
      </>
    );
  }

  return (
    <>
      <h1>Results for “{q}”</h1>
      {isPending ? (
        <Loading label="Searching…" />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.products.length === 0 ? (
        <p>No products match “{q}”. Try a different term.</p>
      ) : (
        <>
          <p className="muted" role="status">
            {data.products.length} {data.products.length === 1 ? 'product' : 'products'} found
          </p>
          <ProductGrid products={data.products} label="Search results" />
        </>
      )}
    </>
  );
}
