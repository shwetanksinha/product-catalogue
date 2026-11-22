import { Link, NavLink, Outlet } from 'react-router';
import { useCategories } from '../api/hooks';
import { SearchBar } from './SearchBar';

function CategoryNav() {
  const { data } = useCategories();
  // Navigation is non-critical: if categories fail to load, pages still work, so fail quietly.
  if (!data) return null;
  return (
    <nav aria-label="Categories" className="category-nav">
      <ul>
        {data.categories.map((category) => (
          <li key={category.slug}>
            <NavLink to={`/category/${encodeURIComponent(category.slug)}`}>{category.name}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Layout() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            Product Catalogue
          </Link>
          <SearchBar />
        </div>
        <div className="container">
          <CategoryNav />
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container muted">Proof of concept · product data from Fake Store API</div>
      </footer>
    </>
  );
}
