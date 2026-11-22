import { useParams } from 'react-router';
import { useCategoryProducts } from '../api/hooks';
import { ProductGrid } from '../components/ProductTile';
import { ErrorState, Loading } from '../components/Status';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data, error, isPending } = useCategoryProducts(slug);

  if (isPending) return <Loading label="Loading category…" />;
  if (error) return <ErrorState error={error} notFoundMessage="That category does not exist." />;

  return (
    <>
      <h1>{data.category.name}</h1>
      <section aria-labelledby="category-top-rated">
        <h2 id="category-top-rated">Top rated in {data.category.name}</h2>
        <ProductGrid products={data.topRated} label={`Top rated in ${data.category.name}`} />
      </section>
      {data.others.length > 0 && (
        <section aria-labelledby="category-more">
          <h2 id="category-more">More in {data.category.name}</h2>
          <ProductGrid products={data.others} label={`More in ${data.category.name}`} />
        </section>
      )}
    </>
  );
}
