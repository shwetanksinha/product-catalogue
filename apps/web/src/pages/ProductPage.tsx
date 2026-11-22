import { Link, useParams } from 'react-router';
import { useProduct } from '../api/hooks';
import { formatPrice, Rating } from '../components/ProductTile';
import { ErrorState, Loading } from '../components/Status';

export function ProductPage() {
  const { id = '' } = useParams();
  const { data, error, isPending } = useProduct(id);

  if (isPending) return <Loading label="Loading product…" />;
  if (error) return <ErrorState error={error} notFoundMessage="That product does not exist." />;

  const { product } = data;
  return (
    <article className="product">
      <div className="product__image">
        <img src={product.imageUrl} alt={product.title} />
      </div>
      <div className="product__details">
        <Link to={`/category/${encodeURIComponent(product.category.slug)}`} className="muted">
          {product.category.name}
        </Link>
        <h1>{product.title}</h1>
        <p className="product__price price">{formatPrice(product.price)}</p>
        <Rating rating={product.rating} />
        <p className="product__description">{product.description}</p>
        <Link to={`/products/${encodeURIComponent(product.id)}/enquire`} className="button button--primary">
          Enquire
        </Link>
      </div>
    </article>
  );
}
