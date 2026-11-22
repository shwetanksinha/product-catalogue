import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function SearchBar() {
  const [params] = useSearchParams();
  const currentQuery = params.get('q') ?? '';
  // Re-mount when the URL query changes (back/forward, links) so the box always reflects it.
  return <SearchForm key={currentQuery} initialTerm={currentQuery} />;
}

function SearchForm({ initialTerm }: { initialTerm: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(initialTerm);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = term.trim();
    if (!q) return;
    navigate(`/search?${new URLSearchParams({ q })}`);
  }

  return (
    <form role="search" className="search" onSubmit={onSubmit}>
      <label htmlFor="search-input" className="visually-hidden">
        Search products
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Search products"
        value={term}
        maxLength={100}
        onChange={(e) => setTerm(e.target.value)}
      />
      <button type="submit" className="button">
        Search
      </button>
    </form>
  );
}
