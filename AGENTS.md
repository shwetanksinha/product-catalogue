# AGENTS.md

Instructions for AI coding agents (Copilot, Claude Code, Cursor…) working in this repository.
Humans: see [README.md](README.md) and [DECISIONS.md](DECISIONS.md).

## What this is

Product catalogue PoC that is meant to **grow into the real product**, not be thrown away.
npm workspaces monorepo:

| Path              | What                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `packages/shared` | API contract: DTO types + zod request schemas. Imported as TS source.   |
| `apps/api`        | Fastify (TypeScript) backend. Only thing that talks to the data source. |
| `apps/web`        | React + Vite (TypeScript) client. Talks to `/api` only.                 |

## Commands (run from the repo root)

- `npm install` — install everything
- `npm run dev` — API on :3000 + web on :5173 (Vite proxies `/api`)
- `npm run check` — lint + typecheck + all tests. **Must pass before you commit.**
- `npm test -w @catalogue/api` / `npm test -w @catalogue/web` — one workspace
- `docker compose up --build` — full stack incl. Mailpit (http://localhost:8080, inbox http://localhost:8025)

## Architecture rules (do not break these)

1. **The browser never calls an upstream data source.** All product data goes through `apps/api`.
   The web client uses `apps/web/src/api/client.ts` with relative `/api` URLs only.
2. **Ports and adapters in the API.** Business logic (`*Service.ts`) depends on interfaces, never on
   Fake Store, nodemailer or Fastify:
   - Product data → `ProductRepository` (adapter: `FakeStoreProductRepository`, decorator: `CachingProductRepository`)
   - Curated "top rated" → `FeaturedProductsProvider`
   - Email → `EmailSender` (adapters: `SmtpEmailSender`, `ConsoleEmailSender`)
   - Concrete adapters are chosen **only** in `apps/api/src/container.ts` (composition root).
3. **Our domain model, not upstream's.** Map upstream payloads to `@catalogue/shared` types inside the adapter
   and validate them with zod. Product IDs are strings.
4. **Contract changes start in `packages/shared`.** Both apps import from there; don't duplicate types.
5. **Errors:** throw `AppError` subclasses from `apps/api/src/shared/errors.ts`; the global handler in
   `app.ts` renders `{ error: { code, message, fields? } }`. Never leak upstream details to clients.
6. **Validate at the trust boundary** with zod (shared schema for enquiries). Client validation is UX only.
7. **Look & feel lives in `apps/web/src/styles/tokens.css`.** Components use tokens, not hard-coded colours.
8. **Config via env only**, parsed in `apps/api/src/config.ts`. Add new vars to `.env.example` and
   `docker-compose.yml`. Never commit secrets or a real `.env`.

## Conventions

- TypeScript strict; `import type` for types; no `any`.
- Tests: Vitest. API route tests use `app.inject` with in-memory fakes (`apps/api/test/helpers.ts`);
  web tests render the real app with a stubbed `fetch` (`apps/web/src/test/utils.tsx`).
  Add or update tests for every behaviour change; prefer testing through public interfaces.
- Comments explain _why_, not _what_. Keep them rare.
- Small, focused commits with conventional-commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## When adding things

- **New data source:** implement `ProductRepository`, add an adapter test with recorded payloads,
  wire it in `container.ts` behind an env switch. Nothing else should change.
- **New email provider (e.g. AWS SES):** implement `EmailSender`, select it via `EMAIL_PROVIDER`.
- **New page:** add a route in `apps/web/src/App.tsx`, a hook in `api/hooks.ts`, and an integration test.
- Record notable assumptions or trade-offs in `DECISIONS.md`.
