# AI usage notes

## Tools and models

| Tool                                                                    | Used for                                                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Copilot, agent mode (Copilot SDK in VS Code)                     | Planning, scaffolding, writing code and tests, running builds/tests/Docker, a browser walkthrough, drafting docs                                      |
| Model                                                                   | The model configured for GitHub Copilot agent mode in this session (one model for the main session; the code-review sub-agent used Copilot's default) |
| `playwright-core` driving local Microsoft Edge (scratch, not committed) | One-off visual walkthrough of every acceptance criterion against the Docker stack                                                                     |

I worked in a single agent session: I gave direction and made decisions, and the agent executed and reported
back. I reviewed the diffs, the test results and the screenshots at each step.

## Agent instruction files

- [`AGENTS.md`](AGENTS.md): architecture rules (no direct data-source calls from the client, ports/adapters,
  where adapters are wired, error envelope, tokens for styling), commands, conventions, and recipes for the
  expected changes (new data source, new email provider, new page). It's written so the _next_ AI-assisted
  change respects the boundaries this PoC sets up.

## Plan / spec

- [`docs/PLAN.md`](docs/PLAN.md): the plan the agent produced in plan mode _after_ asking me structured
  questions. I approved it before any code was written. It contains the confirmed decisions, the architecture,
  the API, the assumptions to record and the test plan.

## Key prompts and moments that shaped the solution

1. **"Plan first, ask before assuming."** I started in plan mode, gave the agent the challenge PDF, and asked it
   to plan rather than build. Instead of picking defaults silently, it came back with structured choices: stack,
   what "top rated" means, how email is delivered, and which extras fit the time-box. My answers set the
   direction: _curated_ top-rated config rather than raw ratings, Mailpit as the local inbox, caching and
   AGENTS.md in, CI/Playwright/rate limiting out (recorded as next steps).
2. **Clarifying the email requirement.** At first I read the email question as being about sending the
   submission to the reviewers. The agent explained that it was the Enquiry criterion ("sales inbox will receive
   an email"), and why a local fake SMTP inbox meets the "no paid services or accounts" rule while staying
   swappable to SES. That conversation is why `EmailSender` is a port with SMTP and console adapters.
3. **Keeping identities separate on a shared machine.** I asked for the repo to be created under my personal
   GitHub account. The agent installed the GitHub CLI, found that `GH_TOKEN`/`GITHUB_TOKEN` env vars pointed at a
   different account, had me log in interactively, and set the commit identity and credential helper **for this
   repo only**, leaving global git config untouched.
4. **Verify, don't assume, upstream behaviour.** Before writing the Fake Store adapter, the agent probed the real
   API and found that unknown IDs return **HTTP 200 with an empty body** (not 404). The adapter handles this
   explicitly, and a test pins it down.
5. **Checking that the tests can fail.** All the web tests passed on the first run, which is suspicious, so the
   agent ran a quick mutation check on its own initiative. It pointed the client at `https://fakestoreapi.com`
   (breaking constraint 2), 8 of 9 tests failed, and it reverted the change. Later, a browser walkthrough
   confirmed that the browser makes zero non-image cross-origin requests.

## Where the AI got things wrong, and how it was caught

| What went wrong                                                                                                                                                                                                                                                                                                                               | How it was caught                                                                                                                  | Fix                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Fastify error handler was registered _after_ the route plugins**, so every error used Fastify's default body (`{statusCode, error, message}`) instead of our `{ error: { code, message, fields } }` envelope. The status codes were all correct.                                                                                        | A manual `curl` smoke test that printed the **response bodies**, not just the status codes. A status-only check would have passed. | Moved the handlers before route registration (with a comment explaining why), and added route tests that assert the exact error body.                                                                                        |
| **`git config credential.helper ""` in PowerShell 5.1**: PowerShell silently drops empty native arguments, so the "reset helpers" line did nothing, and the system credential manager could have pushed with the wrong GitHub account.                                                                                                        | Read back `git config --local --list` after setting it.                                                                            | Wrote the `[credential]` section to `.git/config` directly and verified it.                                                                                                                                                  |
| **The API defaulted `HOST=0.0.0.0`**, which exposed the dev server on the LAN of a shared machine.                                                                                                                                                                                                                                            | Noticed in the startup log ("Server listening at http://10.x…").                                                                   | Default changed to `127.0.0.1`; Docker sets `0.0.0.0` explicitly inside the container. Compose ports are also bound to loopback.                                                                                             |
| **`setState` inside `useEffect`** to sync the search box with the URL (a React anti-pattern that causes cascading renders).                                                                                                                                                                                                                   | The `react-hooks` ESLint rule.                                                                                                     | Reset the form with `key={query}` instead.                                                                                                                                                                                   |
| **Tile images had uneven heights, and the mobile layout was a single giant column.**                                                                                                                                                                                                                                                          | Screenshots from the browser walkthrough (the unit tests can't see layout).                                                        | Fixed the image box sizing; set the grid to a 160px minimum so phones get 2 columns.                                                                                                                                         |
| **Error responses were publicly cacheable.** Routes set `cache-control: public, max-age=60` _before_ awaiting the service, and Fastify keeps that header on the error path. So a transient 502 from the data source could be cached by browsers or a CDN for a minute, undoing the "don't cache failures" rule in `CachingProductRepository`. | A separate AI code-review pass over the branch diff, run by the agent before opening the PR.                                       | The error and not-found handlers now set `cache-control: no-store`; a route test pins this down.                                                                                                                             |
| **Dependency versions newer than the model knew** (TypeScript 6, Vite 8, Vitest 5, React Router 8, Zod 4.6, Fastify 5's `loggerInstance`).                                                                                                                                                                                                    | Compiler errors and checking the exports, e.g. confirming React Router 8 still ships the declarative `<Routes>` API.               | Let npm resolve current versions and adapted, rather than pinning to old versions the model remembered. Also confirmed the workspace package was linked locally, not pulled from the public registry (dependency confusion). |
| A false alarm worth noting: images looked blank in a category screenshot, and `HEAD` requests to the image host returned 403.                                                                                                                                                                                                                 | A follow-up `GET` returned 200, so the blanks were lazy loading in a headless full-page screenshot.                                | No code change. The walkthrough now scrolls before taking the screenshot.                                                                                                                                                    |

## How the output was reviewed

- Small, themed commits (API, web, infrastructure, docs), so each one can be reviewed on its own.
- `npm run check` (lint + strict typecheck + 46 tests) is green at every commit.
- The tests assert behaviour through public interfaces (HTTP `inject`, a rendered app), not implementation
  details, so they survive refactoring.
- The full stack was run with `docker compose up --build`, and each acceptance criterion was checked in a real
  browser and in the Mailpit inbox (including checking that `<script>` in a message arrives HTML-escaped).
- I reviewed the final diff in the pull request before submitting.
