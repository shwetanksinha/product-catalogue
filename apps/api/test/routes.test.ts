import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { CatalogueService } from '../src/modules/catalogue/CatalogueService';
import { StaticFeaturedProductsProvider } from '../src/modules/catalogue/FeaturedProducts';
import { EnquiryService } from '../src/modules/enquiry/EnquiryService';
import { UpstreamError } from '../src/shared/errors';
import { InMemoryProductRepository, RecordingEmailSender, makeProduct } from './helpers';

const products = Array.from({ length: 6 }, (_, i) =>
  makeProduct({ id: String(i + 1), title: i === 0 ? 'Backpack <script>' : `Item ${i + 1}` }),
);

let app: FastifyInstance;
let email: RecordingEmailSender;

async function createApp(repo = new InMemoryProductRepository(products)) {
  email = new RecordingEmailSender();
  return buildApp({
    catalogue: new CatalogueService(repo, new StaticFeaturedProductsProvider(['1', '2', '3', '4', '5']), {
      categoryTopRatedLimit: 3,
    }),
    enquiry: new EnquiryService({
      products: repo,
      email,
      options: { salesInbox: 'sales@shop.test', publicWebUrl: 'http://shop.test' },
    }),
  });
}

beforeEach(async () => {
  app = await createApp();
});
afterEach(async () => {
  await app.close();
});

const validEnquiry = {
  productId: '1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0000',
  message: 'Do you ship to <b>London</b>?',
};

describe('catalogue routes', () => {
  it('GET /api/products/featured returns the 5 curated products', async () => {
    const res = await app.inject('/api/products/featured');
    expect(res.statusCode).toBe(200);
    expect(res.json().products.map((p: { id: string }) => p.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('GET /api/categories/:slug/products splits top rated and others', async () => {
    const res = await app.inject('/api/categories/electronics/products');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.topRated).toHaveLength(5);
    expect(body.others).toHaveLength(1);
  });

  it('GET /api/search requires a term and uses the error envelope', async () => {
    const res = await app.inject('/api/search?q=%20');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a search term',
        fields: { q: 'Enter a search term' },
      },
    });
  });

  it('GET /api/search returns only matching products', async () => {
    const res = await app.inject('/api/search?q=item%206');
    expect(res.json()).toMatchObject({ query: 'item 6', products: [{ id: '6' }] });
  });

  it('GET /api/products/:id returns 404 with the error envelope for unknown products', async () => {
    const res = await app.inject('/api/products/999');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('maps product source failures to 502 without leaking details', async () => {
    const broken = new InMemoryProductRepository([]);
    broken.listProducts = async () => {
      throw new UpstreamError('Product source is unreachable', { cause: new Error('ECONNRESET 10.0.0.1') });
    };
    const brokenApp = await createApp(broken);
    const res = await brokenApp.inject('/api/products/featured');
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Product source is unreachable' },
    });
    // A transient upstream failure must not be cached by browsers or CDNs.
    expect(res.headers['cache-control']).toBe('no-store');
    await brokenApp.close();
  });

  it('marks successful catalogue responses cacheable but not-found errors as no-store', async () => {
    const ok = await app.inject('/api/products/1');
    expect(ok.headers['cache-control']).toBe('public, max-age=60');
    const missing = await app.inject('/api/products/999');
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  it('returns 404 envelope for unknown routes', async () => {
    const res = await app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/enquiries', () => {
  it('emails the sales inbox and returns 202', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/enquiries', payload: validEnquiry });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ status: 'received' });

    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message?.to).toBe('sales@shop.test');
    expect(message?.replyTo).toBe('ada@example.com');
    expect(message?.subject).toBe('Enquiry: Backpack <script>');
    expect(message?.text).toContain('Ada Lovelace');
    expect(message?.text).toContain('http://shop.test/products/1');
    // User and upstream content is escaped in the HTML body.
    expect(message?.html).toContain('Do you ship to &lt;b&gt;London&lt;/b&gt;?');
    expect(message?.html).toContain('Backpack &lt;script&gt;');
    expect(message?.html).not.toContain('<script>');
  });

  it('rejects invalid input with per-field messages and sends nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      payload: { productId: '1', name: '', email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.fields).toMatchObject({
      name: 'Name is required',
      email: 'Enter a valid email address',
    });
    expect(email.sent).toHaveLength(0);
  });

  it('rejects header-injection attempts in single-line fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      payload: { ...validEnquiry, name: 'Ada\r\nBcc: victim@example.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(email.sent).toHaveLength(0);
  });

  it('returns 404 when the product does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      payload: { ...validEnquiry, productId: '999' },
    });
    expect(res.statusCode).toBe(404);
    expect(email.sent).toHaveLength(0);
  });

  it('silently accepts but does not send when the honeypot is filled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      payload: { ...validEnquiry, website: 'http://spam.example' },
    });
    expect(res.statusCode).toBe(202);
    expect(email.sent).toHaveLength(0);
  });

  it('returns 502 when email delivery fails, so the customer is not falsely thanked', async () => {
    email.failWith = new Error('SMTP down');
    const res = await app.inject({ method: 'POST', url: '/api/enquiries', payload: validEnquiry });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('EMAIL_DELIVERY_FAILED');
  });

  it('rejects malformed JSON and oversized bodies with the error envelope', async () => {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('VALIDATION_ERROR');

    const huge = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      payload: { ...validEnquiry, message: 'x'.repeat(20_000) },
    });
    expect(huge.statusCode).toBe(413);
  });
});
