# Decisions and assumptions

The acceptance criteria deliberately leave gaps. This file records how I filled them, what I cut, and why.

## Assumptions

### Home page: "I have chosen 5 products to be top rated"

- **"Chosen" means curated by the owner, not computed.** The owner picks the products in
  [`apps/api/config/featured-products.json`](apps/api/config/featured-products.json): an ordered list of IDs,
  shown in that order. Fake Store's star rating is _not_ what decides "top rated" on the home page. The wording
  says the owner chose them, and a merchant usually wants to promote particular products (margin, stock,
  seasonality) rather than whatever has the most stars.
- The file is read and validated **at startup** (fail fast on a malformed edit). Changing it needs an API restart,
  which is acceptable for a PoC; the `FeaturedProductsProvider` port is where a CMS or admin screen would plug in.
- If a curated ID no longer exists in the catalogue, it is **skipped and logged**, not padded with another
  product. A silent substitute would hide a broken configuration from the owner.
- The list isn't hard-limited to 5. The criterion describes today's choice, not a rule, so the default file
  has 5 entries.

### Category page: "top rated products for that category" + "additional products"

- **Top rated in a category = curated products in that category first (in curated order), then topped up with
  the highest-rated remaining products** until there are `CATEGORY_TOP_RATED_LIMIT` (default 3). This keeps the
  owner's choices consistent across pages while making sure every category has a "top rated" section, even
  one with no curated products.
- "Additional products" = everything else in the category, in source order. No product appears twice.
- Categories come from the data source. Our URLs use slugs (`/category/mens-clothing`) instead of Fake Store's
  raw names (`men's clothing`), so URLs stay clean and independent of the source.

### Search

- Searching happens **when the Search button is clicked** (or Enter is pressed), as the criterion says. There is
  no search-as-you-type.
- "Text matching the search term" = **case-insensitive; every word must appear** somewhere in the title,
  description or category name. So `mens jacket` matches "Mens Cotton Jacket". AND across words gives precise
  results, which fits "I only see products that match". There is no fuzzy matching or ranking in the PoC.
- Matching runs **on the server**, behind the `ProductRepository` port. Fake Store has no search endpoint, so its
  adapter filters in memory. A real search engine (OpenSearch, Algolia) would implement the same method
  natively.
- A blank term is rejected (400 from the API; the client simply doesn't navigate). Terms are capped at 100
  characters.
- The term lives in the URL (`/search?q=…`), so results can be shared, bookmarked, and work with back/forward.

### Product page

- "Product tile" = the whole card is a single link (image, title, price, rating) to `/products/:id`.
- Unknown product → a friendly "That product does not exist." message, with a 404 from the API.

### Enquiry

- **Fields:** name and email are required; phone and message are optional. That is the minimum the sales team
  needs to reply, and every extra required field costs conversions. The product is taken from the page, not
  typed in.
- **"The sales inbox will receive an email"**: the API emails `SALES_INBOX_EMAIL` with the product details,
  a link back to the product and the customer's details, with `Reply-To` set to the customer so sales can
  answer directly. The product details are **looked up on the server**, not trusted from the client.
- **Local "sales inbox" = Mailpit**, a fake SMTP server with a web UI started by Docker Compose. It satisfies
  "no paid services or accounts". Production would use SES or any SMTP relay via configuration.
- **"Thank you" is shown only after the email is actually handed to the email provider.** If sending fails, the
  customer sees an error and keeps their form input (HTTP 502). A false "thank you" for a lost lead is the worst
  outcome for this business.
- The API returns **202 Accepted**. Sending happens synchronously today, but 202 keeps the contract valid when
  delivery moves to a queue (see "Next").
- No confirmation email to the customer. It wasn't asked for, and sending email to arbitrary user-supplied
  addresses invites abuse without rate limiting.

### General

- **Currency is USD.** Fake Store prices have no currency, so the adapter sets it explicitly. The contract
  carries `{ amount, currency }`, so a multi-currency source needs no contract change.
- **Product IDs are strings** in our contract, even though Fake Store uses integers. Future sources (SKUs,
  UUIDs) then fit without a breaking change.
- **Product images load directly from the URL the API returns** (today, Fake Store's image host). Constraint 2 is
  about product _data_; image bytes are static assets, so they aren't proxied. Proxying them would add latency and
  an open-proxy/SSRF surface for no PoC benefit. Because the image URL comes from our API, moving images to
  S3/CloudFront later is a backend-only change.
- **English only, desktop and mobile web**, no auth, no cart or checkout. This is a catalogue plus enquiry flow,
  as described.

## Dropped or simplified (and why)

| Item                                  | Decision & reason                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persisting enquiries                  | **Dropped.** Email is the stated outcome. Storage adds a database to run locally and isn't needed to prove the flow. First item in "Next".                                                                                                                                                  |
| Rate limiting / CAPTCHA on enquiries  | **Simplified** to a honeypot field plus strict validation, body size limits and header-injection checks. Real rate limiting needs shared state (Redis/WAF) to be meaningful behind multiple instances.                                                                                      |
| Pagination, sorting, filters          | **Dropped.** The source has 20 products. The repository port accepts a query object, so these can be added without breaking callers.                                                                                                                                                        |
| Browser end-to-end tests (Playwright) | **Simplified.** Web integration tests render the whole app (router, data fetching, pages) against a stubbed `fetch`. During development I also ran a one-off browser walkthrough of every criterion against the Docker stack, but didn't commit it as a suite, to stay within the time-box. |
| CI pipeline                           | **Dropped** for time. `npm run check` is the single command CI would run.                                                                                                                                                                                                                   |
| Admin UI for curating "top rated"     | **Simplified** to a validated JSON file behind a port.                                                                                                                                                                                                                                      |
| Image proxy / CDN                     | See assumptions: not needed for the PoC.                                                                                                                                                                                                                                                    |
| Infrastructure as code                | **Dropped.** The README describes the AWS mapping. Writing CDK/Terraform without deploying it would be unverified code.                                                                                                                                                                     |

## How the design supports growth beyond the PoC

The three things the brief says will change are each behind a seam:

| Expected change     | Seam                                                                                         | What a change looks like                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product data source | `ProductRepository` port; adapters map into our own `Product` model                          | New adapter (e.g. `PostgresProductRepository`, a PIM, Shopify) and one line in `container.ts`. Services, routes, contract and client stay as they are. The caching decorator wraps any adapter. |
| Email provider      | `EmailSender` port                                                                           | `SesEmailSender` (or SES over SMTP with config only), selected by `EMAIL_PROVIDER`.                                                                                                             |
| Look and feel       | Design tokens in `tokens.css`; components use tokens; pages are composed of small components | Re-theme by editing tokens; replace components with a design-system library page by page.                                                                                                       |

Other choices that keep the foundation sound:

- **A clear frontend ↔ backend ↔ data-source boundary.** The client knows only our API contract
  (`packages/shared`), never the data source. Upstream payloads are validated with zod, so a contract change
  upstream shows up as a clear 502, not broken UI.
- **One contract package.** The enquiry schema is shared, so client and server validation can't drift.
- **Composition root.** All wiring is in `container.ts`, and services take their dependencies through the
  constructor, so every layer is testable with in-memory fakes (see `apps/api/test/helpers.ts`).
- **Consistent error envelope**, typed error classes, and config validated at startup.
- **Stateless API**, configured by env, packaged as a container: it scales horizontally and maps directly onto
  ECS Fargate or App Runner. The in-memory cache is per instance, which is fine to start with; it would move to
  Redis or a CDN if needed.
- **Security basics:** helmet headers on the API, a CSP plus security headers on nginx, no CORS (same-origin by
  design, so cross-origin browser calls are blocked), a 16 KB body limit, strict input validation (including
  CR/LF rejection in single-line fields), HTML-escaping of every value in the email, non-numeric IDs never
  reaching the upstream URL, loopback-only port bindings, the API container running as non-root, and no secrets
  in the repo.

## What I'd do next with another day

1. **Persist enquiries and send them asynchronously.** Write to a database (or SQS) first, then send email from a
   worker with retries. A lead is never lost if the email provider is down, and the 202 contract already fits.
2. **Rate limiting** on `POST /api/enquiries` (per IP and per email), and a CAPTCHA if spam appears.
3. **CI** (GitHub Actions running `npm run check` plus `docker compose build`), and a Playwright smoke test of the
   enquiry journey against the compose stack.
4. **An `SesEmailSender` and IaC** (CDK) for the AWS deployment: CloudFront + S3 for the web, App Runner or ECS
   for the API, and SES.
5. **A curation UI or CMS** for top-rated products, plus product data in our own store, so the owner can manage
   it without a deploy.
6. Observability: request IDs propagated to the client, structured error tracking (Sentry or CloudWatch), and
   uptime checks.
7. UX polish once the creative work lands: skeleton loaders, image placeholders, breadcrumbs, empty states,
   SEO metadata (or SSR if SEO matters for the catalogue).

## Time spent

Measured from the session and commit timestamps (started 20:22, PR opened about 21:35 the same evening). Tests were
written alongside each slice, so the build and test times overlap.

| Activity                                                                                  | Time            |
| ----------------------------------------------------------------------------------------- | --------------- |
| Planning: reading the brief, clarifying questions, plan, repo and GitHub account setup    | ~15 min         |
| Building + unit/route/integration tests: shared contract, API, web client                 | ~35 min         |
| Verifying: Docker stack, browser walkthrough of every criterion, layout fixes             | ~10 min         |
| Reviewing and documenting: AI code-review pass and fixes, README, DECISIONS, AI_USAGE, PR | ~15 min         |
| **Total (agent session)**                                                                 | **~1 h 15 min** |

These figures don't include my own read-through of the PR before submitting.
