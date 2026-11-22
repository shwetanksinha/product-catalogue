# Product Catalogue — proof of concept

A small product catalogue where customers browse products, search them, and send an enquiry. It's built as the
**first slice of the real product**, not a throwaway: the product data source, the look and feel and the email
provider can each be swapped without touching the rest.

- **Client:** React 19 + TypeScript (Vite)
- **Backend:** Node.js + TypeScript (Fastify)
- **Contract:** a shared TypeScript package (`packages/shared`) with the DTO types and the zod validation schema
  used by both sides

See [DECISIONS.md](DECISIONS.md) for assumptions and trade-offs, [AI_USAGE.md](AI_USAGE.md) for how AI was used,
and [AGENTS.md](AGENTS.md) for the instructions given to AI coding agents.

---

## Quick start (Docker, about 3 minutes)

Prerequisites: Docker Desktop (or Docker Engine with Compose v2). No accounts or API keys are needed.

```bash
docker compose up --build
```

| What                       | URL                                         |
| -------------------------- | ------------------------------------------- |
| Shop                       | http://localhost:8080                       |
| Sales inbox (Mailpit)      | http://localhost:8025                       |
| API, through the web proxy | http://localhost:8080/api/products/featured |

The stack publishes three host ports, all bound to `127.0.0.1`: **8080** (shop), **8025** (Mailpit UI) and
**1025** (Mailpit SMTP, only used by `npm run dev`). If any of them is taken, copy `.env.example` to `.env` and
change `WEB_PORT` (and `PUBLIC_WEB_URL` to match), `MAILPIT_UI_PORT` or `MAILPIT_SMTP_PORT`. Or, as a one-off:
`WEB_PORT=8081 PUBLIC_WEB_URL=http://localhost:8081 docker compose up --build`
(PowerShell: `$env:WEB_PORT=8081; $env:PUBLIC_WEB_URL='http://localhost:8081'; docker compose up --build`).

Stop with `Ctrl+C`, then `docker compose down`.

### Try the acceptance criteria

| Criterion     | How to check it                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home page     | Open the shop: the 5 curated "Top rated" products are shown.                                                                                        |
| Category page | Click a category in the header, e.g. **Electronics**: "Top rated in …" first, then "More in …".                                                     |
| Search        | Type `jacket` in the search bar and click **Search**: only matching products are shown.                                                             |
| Product page  | Click any product tile.                                                                                                                             |
| Enquiry       | On a product, click **Enquire**, fill in name and email, and send. You see "Thank you!", and the email appears in Mailpit at http://localhost:8025. |

### Choosing the 5 "top rated" products

Edit [`apps/api/config/featured-products.json`](apps/api/config/featured-products.json) (ordered list of
product IDs), then `docker compose restart api`. The file is mounted into the container, so you don't need to
rebuild. It is validated at startup: a malformed file stops the API with a clear error, and an unknown ID is
skipped with a warning in the logs.

---

## Local development (without Docker)

Prerequisites: Node.js 22+ and npm 10+.

```bash
npm install
npm run dev            # API on http://127.0.0.1:3000, web on http://localhost:5173 (proxies /api)
```

By default the API uses the `console` email provider, which writes enquiry emails to the API log. To deliver them
to a real inbox, run `docker compose up -d mailpit`, copy `.env.example` to `.env`, and set `EMAIL_PROVIDER=smtp`
and `SMTP_HOST=127.0.0.1`.

### Quality checks

```bash
npm run check          # eslint + tsc (all workspaces) + all tests
npm test               # tests only
npm test -w @catalogue/api
npm test -w @catalogue/web
```

---

## Configuration

All configuration comes from environment variables, which are validated at startup in
[`apps/api/src/config.ts`](apps/api/src/config.ts). Every variable is documented in
[`.env.example`](.env.example). Nothing is secret by default; real SMTP credentials would go in an uncommitted
`.env` or a secret manager.

| Variable                   | Default                         | Purpose                                                   |
| -------------------------- | ------------------------------- | --------------------------------------------------------- |
| `FAKESTORE_BASE_URL`       | `https://fakestoreapi.com`      | Product data source                                       |
| `CACHE_TTL_SECONDS`        | `300`                           | API-side cache of product data (`0` disables it)          |
| `FEATURED_PRODUCTS_FILE`   | `config/featured-products.json` | Curated "top rated" list                                  |
| `CATEGORY_TOP_RATED_LIMIT` | `3`                             | Minimum number of "top rated" products on a category page |
| `EMAIL_PROVIDER`           | `console` (`smtp` in Docker)    | `smtp` or `console`                                       |
| `SMTP_*`, `MAIL_FROM`      | Mailpit in Docker               | SMTP transport                                            |
| `SALES_INBOX_EMAIL`        | `sales@catalogue.local`         | Where enquiries are sent                                  |
| `PUBLIC_WEB_URL`           | `http://localhost:8080`         | Used for product links in emails                          |

---

## Architecture

```
 Browser ──► web (nginx: static React build) ──/api──► api (Fastify)
                                                         │
                         ┌───────────────────────────────┼──────────────────────────┐
                         ▼                               ▼                          ▼
              ProductRepository (port)      FeaturedProductsProvider (port)   EmailSender (port)
                         │                               │                          │
         CachingProductRepository (TTL)          JSON config file            SmtpEmailSender ─► Mailpit
                         │                                                   ConsoleEmailSender
         FakeStoreProductRepository ─► fakestoreapi.com
```

- **The browser never calls Fake Store.** It talks only to its own origin (`/api`, proxied by nginx in Docker
  and by Vite in dev). The API maps Fake Store's payloads into our own domain model, and validates them on the
  way in.
- **Ports and adapters.** The services (`CatalogueService`, `EnquiryService`) depend only on interfaces.
  Concrete adapters are chosen in a single place, [`container.ts`](apps/api/src/container.ts).
- **Look and feel** is isolated in design tokens ([`tokens.css`](apps/web/src/styles/tokens.css)).

```
apps/
  api/          Fastify API
    src/modules/catalogue/   ProductRepository port, Fake Store adapter, cache, service, routes
    src/modules/enquiry/     EmailSender port, SMTP/console adapters, email template, service, routes
    src/app.ts               HTTP app (helmet, error envelope); src/container.ts wires the adapters
    config/featured-products.json
    test/                    service, adapter, cache and HTTP route tests
  web/          React client
    src/api/                 typed client + TanStack Query hooks
    src/pages/, src/components/, src/styles/tokens.css
    src/app.test.tsx         integration tests (real app, stubbed fetch)
packages/
  shared/       DTO types + zod enquiry schema (single source of truth for the contract)
```

### API

| Method & path                        | Returns                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `GET /api/products/featured`         | `{ products }`: the curated top rated products, in order |
| `GET /api/categories`                | `{ categories: [{ slug, name }] }`                       |
| `GET /api/categories/:slug/products` | `{ category, topRated, others }`                         |
| `GET /api/search?q=term`             | `{ query, products }`                                    |
| `GET /api/products/:id`              | `{ product }`                                            |
| `POST /api/enquiries`                | `202 { status: "received" }`                             |
| `GET /health`                        | `{ status: "ok" }`                                       |

Errors always use the same shape: `{ "error": { "code", "message", "fields"? } }`. The status codes are 400
(validation), 404 (not found), 413 (body too large), and 502 (data source or email provider failed).

### Running on AWS (not built; the shape is compatible)

The `web` image can be replaced by S3 + CloudFront, with `/api/*` routed to the API. The `api` image runs as-is
on ECS Fargate or App Runner (stateless; config comes from env and secrets from Secrets Manager or SSM). Email
switches to Amazon SES, either over its SMTP interface (no code change: set `SMTP_*`) or through an `SesEmailSender`
adapter.

---

## Why this stack

- **React + TypeScript web app** rather than native mobile: it is the fastest path to something the entrepreneur
  can click today on any device. A single TypeScript codebase across client, server and the shared contract means
  one language, one test runner and type-checked API boundaries. Native apps can consume the same API later.
- **Node.js + TypeScript with Fastify** rather than Laravel: it shares the contract package with the client.
  Fastify gives strong defaults (body limits, `inject()` for fast HTTP tests, pino logging) with little
  ceremony. Express would also be fine; Fastify's built-in test injection and maintained plugin set tipped it.

---

## Time spent

See the "Time spent" section in [DECISIONS.md](DECISIONS.md#time-spent).
