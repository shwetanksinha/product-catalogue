import type { Money, Product } from '@catalogue/shared';
import { Link } from 'react-router';

export function formatPrice(price: Money): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency }).format(price.amount);
}

export function Rating({ rating }: { rating: Product['rating'] }) {
  if (!rating) return null;
  return (
    <span className="rating" aria-label={`Rated ${rating.average} out of 5 from ${rating.count} reviews`}>
      ★ {rating.average.toFixed(1)} <span className="muted">({rating.count})</span>
    </span>
  );
}

export function ProductTile({ product }: { product: Product }) {
  return (
    <Link to={`/products/${encodeURIComponent(product.id)}`} className="tile" data-testid="product-tile">
      <div className="tile__image">
        <img src={product.imageUrl} alt="" loading="lazy" />
      </div>
      <div className="tile__body">
        <h3 className="tile__title">{product.title}</h3>
        <div className="tile__meta">
          <span className="price">{formatPrice(product.price)}</span>
          <Rating rating={product.rating} />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, label }: { products: Product[]; label: string }) {
  return (
    <ul className="grid" aria-label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  );
}
