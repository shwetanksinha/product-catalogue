# Plan: AI-Native Engineer code challenge — Product Catalogue PoC

Started: 2026-11-22 20:22 IST (track actual time for the "Time spent" section).

## Problem

Build a small product catalogue (home/featured, category, search, product details, enquiry → email)
that is a _foundation_, not a throwaway: product data source, look & feel, and email provider must be swappable.
Graded on judgement: design boundaries, documented assumptions, code quality, tests, AI practice.

## Decisions (confirmed with user)

- **Repo**: public `github.com/shwetanksinha/product-catalogue`. Install GitHub CLI via winget; user runs `gh auth login` as shwetanksinha.
- **Git identity (repo-local only)**: `shwetanksinha <reply2tank2@gmail.com>`; global Adobe identity untouched.
- **Stack**: React + TypeScript (Vite) web client; Node.js + TypeScript (Fastify) API; npm workspaces monorepo.
- **Top rated**: owner-curated product IDs in a backend config file. Category "top rated" = curated items in that category, topped up by highest Fake Store `rating.rate`.
- **Email**: `EmailSender` port + SMTP (nodemailer) adapter; Mailpit container in compose acts as the sales inbox (UI at http://localhost:8025). Swappable to SES later via env.
- **Extras**: in-memory TTL cache in front of Fake Store; `AGENTS.md`. (No CI, no Playwright, no rate limiting → listed as "next steps".)
- **Git flow**: `main` with a minimal initial commit → feature branch `feature/product-catalogue` → PR into `main`, left open; PR description written carefully.

## Architecture

```
product-catalogue/
  apps/api/            Fastify TS
    src/config.ts               env parsing/validation (zod)
    src/app.ts                  buildApp(deps) — DI for tests
    src/modules/catalogue/
      domain.ts                 Product, Category (our model, not Fake Store's)
      ProductRepository.ts      port
      FakeStoreProductRepository.ts   adapter (maps upstream → domain)
      CachingProductRepository.ts     TTL decorator
      FeaturedProducts.ts       curated IDs loader (config/featured-products.json)
      CatalogueService.ts       featured / byCategory(topRated+others) / search / getById
      routes.ts
    src/modules/enquiry/
      EmailSender.ts            port
      SmtpEmailSender.ts        nodemailer adapter
      EnquiryService.ts         validate product exists, compose email (reply-to customer)
      routes.ts
  apps/web/            Vite React TS
    src/api/client.ts           typed fetch to /api only (never Fake Store)
    src/pages/                  Home, Category, Search, Product (+ Enquiry form), ThankYou
    src/components/             Layout, CategoryNav, SearchBar, ProductTile, ProductGrid
    src/theme/tokens.css        CSS variables → look & feel swappable
  packages/shared/     DTO types + zod enquiry schema shared by web & api
  docker-compose.yml   web (nginx static + /api proxy), api, mailpit
  .env.example, README.md, DECISIONS.md, AI_USAGE.md, AGENTS.md
```

### API

- `GET /health`
- `GET /api/products/featured`
- `GET /api/categories`
- `GET /api/categories/:slug/products` → `{ topRated, others }`
- `GET /api/products?q=term` (server-side search)
- `GET /api/products/:id`
- `POST /api/enquiries` → 202 `{ ok: true }`
- Consistent error shape `{ error: { code, message } }`; upstream failure → 502; unknown product → 404; validation → 400.

## Assumptions to record (DECISIONS.md)

- "Chosen 5 products" = curated config the owner edits; missing IDs are skipped + logged (no silent padding on home).
- Category top rated: up to 3 (curated-in-category first, then by rating); "additional" = the rest.
- Search: case-insensitive substring over title, description, category; triggered by search button/Enter; empty term rejected; query in URL (`/search?q=`).
- Enquiry fields: name, email (required), phone (optional), message (optional, length-limited); product context sent with it; honeypot field for basic spam. No persistence (dropped — next step: DB/queue + retries).
- Sales inbox address via env `SALES_INBOX_EMAIL`.
- Security basics: zod validation both sides, @fastify/helmet, CORS restricted to web origin, body size limit, HTML-escaped email content, no secrets committed.
- No auth, no cart, no pagination (20 products) — justified cuts.

## Testing

- API (Vitest + `app.inject`): catalogue service rules (featured, category split, search), Fake Store adapter mapping with fixtures, cache decorator, enquiry route (valid → sender called; invalid → 400; unknown product → 404; email failure → 502).
- Web (Vitest + React Testing Library): search flow, product tile → details link, enquiry form validation + thank-you.

## Notes

- Shared machine: repo-local git config only; don't touch global config.
- Keep a running log of key prompts / AI mistakes in session `files/ai-log.md` to feed AI_USAGE.md.
- Verify final step from a clean `docker compose up --build` within the 10-minute bar.
