import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { categoriesResponse, makeProduct, mockApi, renderApp } from './test/utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const featured = ['1', '2', '3', '4', '5'].map((id) => makeProduct(id));
const product = makeProduct('7', { title: 'Mens Cotton Jacket', description: 'Warm and light.' });

describe('Home page', () => {
  it('shows the 5 featured products, and a tile opens the product details page', async () => {
    const { requests } = mockApi({
      'GET /api/products/featured': { products: featured },
      'GET /api/categories': categoriesResponse,
      'GET /api/products/3': { product: featured[2] },
    });
    renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Top rated products' });
    const tiles = within(grid).getAllByRole('link');
    expect(tiles).toHaveLength(5);

    await userEvent.click(within(grid).getByRole('link', { name: /Product 3/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Product 3' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enquire' })).toHaveAttribute('href', '/products/3/enquire');

    // Constraint: the browser never calls the product data source directly.
    expect(requests.every((r) => r.url.startsWith('/api/'))).toBe(true);
  });

  it('shows an error message when the API fails', async () => {
    mockApi({
      'GET /api/products/featured': () => ({
        status: 502,
        body: { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Product source is unreachable' } },
      }),
      'GET /api/categories': categoriesResponse,
    });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Product source is unreachable');
  });
});

describe('Category page', () => {
  it('shows top rated products and additional products for the category', async () => {
    mockApi({
      'GET /api/products/featured': { products: [] },
      'GET /api/categories': categoriesResponse,
      'GET /api/categories/electronics/products': {
        category: { slug: 'electronics', name: 'Electronics' },
        topRated: [makeProduct('1'), makeProduct('2')],
        others: [makeProduct('3')],
      },
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Electronics' }));

    const topRated = await screen.findByRole('list', { name: 'Top rated in Electronics' });
    expect(within(topRated).getAllByRole('link')).toHaveLength(2);
    const more = screen.getByRole('list', { name: 'More in Electronics' });
    expect(within(more).getAllByRole('link')).toHaveLength(1);
  });
});

describe('Search', () => {
  it('searches when the Search button is clicked and shows only the matching products', async () => {
    const { requests } = mockApi({
      'GET /api/products/featured': { products: featured },
      'GET /api/categories': categoriesResponse,
      'GET /api/search?q=jacket': { query: 'jacket', products: [product] },
    });
    renderApp('/');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), '  jacket ');
    expect(requests.some((r) => r.url.startsWith('/api/search'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(within(results).getAllByRole('link')).toHaveLength(1);
    expect(within(results).getByText('Mens Cotton Jacket')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Results for “jacket”' })).toBeInTheDocument();
  });

  it('does not search for a blank term', async () => {
    const { requests } = mockApi({
      'GET /api/products/featured': { products: featured },
      'GET /api/categories': categoriesResponse,
    });
    renderApp('/');
    await userEvent.type(screen.getByRole('searchbox'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(requests.some((r) => r.url.startsWith('/api/search'))).toBe(false);
  });

  it('tells the user when nothing matches', async () => {
    mockApi({
      'GET /api/categories': categoriesResponse,
      'GET /api/search?q=zzz': { query: 'zzz', products: [] },
    });
    renderApp('/search?q=zzz');
    expect(await screen.findByText(/No products match “zzz”/)).toBeInTheDocument();
  });
});

describe('Enquiry', () => {
  const routes = {
    'GET /api/categories': categoriesResponse,
    'GET /api/products/7': { product },
  };

  it('validates the form before sending anything', async () => {
    const { requests } = mockApi(routes);
    renderApp('/products/7/enquire');

    await userEvent.click(await screen.findByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('submits contact details and shows a thank you message', async () => {
    const { requests } = mockApi({
      ...routes,
      'POST /api/enquiries': () => ({ status: 202, body: { status: 'received' } }),
    });
    renderApp('/products/7/enquire');

    await userEvent.type(await screen.findByLabelText('Name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Message (optional)'), 'Is this in stock?');
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeInTheDocument();
    const post = requests.find((r) => r.method === 'POST');
    expect(post?.body).toMatchObject({
      productId: '7',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Is this in stock?',
    });
  });

  it('keeps the form and shows the error when delivery fails', async () => {
    mockApi({
      ...routes,
      'POST /api/enquiries': () => ({
        status: 502,
        body: {
          error: {
            code: 'EMAIL_DELIVERY_FAILED',
            message: 'We could not send your enquiry. Please try again shortly.',
          },
        },
      }),
    });
    renderApp('/products/7/enquire');

    await userEvent.type(await screen.findByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not send your enquiry');
    expect(screen.queryByRole('heading', { name: 'Thank you!' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeEnabled());
  });
});
