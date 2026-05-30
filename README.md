# Rentotal

Rentotal is a backend-first rental/apartment watch list and price tracking platform.

The current product is an MVP foundation for manually tracking properties and source URLs, collecting price snapshots, and preparing for future apartment research features. It is built with TypeScript, Express, PostgreSQL, and Prisma.

## Current State

Completed phases:

- Phase 0/1 Watch List foundation: properties, property sources, watch lists/items, watch intakes, placeholder scraping, alerts, and AI-ready document storage.
- Phase 2 HTTP scraper: scrape tasks/runs, plain HTTP collection, conservative generic HTML rent parsing, RawPage storage, and price snapshots from parsed rent data.
- Phase 3 effective rent, price history, alerts: deterministic effective rent calculation, latest price, price history, price change alerts, budget alerts, and alert deduplication.
- Phase 4 Playwright fallback: browser fallback for dynamic pages after HTTP parsing finds no rent.
- Phase 5 direct JSON endpoint discovery: candidate JSON endpoint capture during browser fallback, source metadata persistence, direct JSON collector, and generic JSON rent parser.

Current preparation:

- Phase 7G Minimal Admin Dashboard Frontend: implemented as a minimal local Vite + React + TypeScript dashboard using existing backend APIs.
- Phase 7H Frontend Hardening and API Client Cleanup: implemented as a maintainability-focused cleanup pass with a small typed API client, clearer dashboard error handling, and cleaner frontend structure.

## Not Implemented Yet

These features are intentionally out of scope for the current implementation:

- maps
- Google Places
- AI calls or agent research
- embeddings or pgvector
- reviews/social/forum crawling
- scoring or recommendations
- public or complex frontend
- authentication
- payments or notification delivery

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file with a PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rentotal"
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

Start the development server:

```bash
npm run dev
```

The API starts from `src/server.ts` and mounts routes under `/api`.

Install frontend dependencies:

```bash
npm --prefix frontend install
```

Start the frontend dashboard:

```bash
npm run frontend:dev
```

Build the frontend dashboard:

```bash
npm run frontend:build
```

The admin dashboard runs on Vite's default local URL (typically `http://localhost:5173`) and calls the backend API at `http://localhost:3000` by default during local development. No Vite proxy is configured; set `VITE_API_BASE_URL` when the backend uses a different origin. In non-Vite local setups, the frontend falls back to same-origin when `VITE_API_BASE_URL` is not set.

Optional override:

```bash
# PowerShell
$env:VITE_API_BASE_URL="http://localhost:3000"
npm run frontend:dev
```

## Test And Validation

Run TypeScript validation:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Regenerate Prisma client:

```bash
npm run prisma:generate
```

Validate the Prisma schema with `DATABASE_URL` available:

```bash
npx prisma validate
```

If you need to provide `DATABASE_URL` inline in PowerShell:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rentotal"; npx prisma validate
```

## Local Price Check Runner

Run the one-shot price check runner:

```bash
npm run price-check:run
```

Safe default controls:

- `cooldownMinutes`: `360`
- `dryRun`: `false`
- `force`: `false`
- `maxSources`: unset

Examples:

```bash
npm run price-check:run -- --dry-run
npm run price-check:run -- --cooldown-minutes 360 --max-sources 50
npm run price-check:run -- --force
```

Windows Task Scheduler example:

```text
Program: npm.cmd
Arguments: run price-check:run -- --cooldown-minutes 360 --max-sources 50
Start in: <project directory>
```

cron example:

```bash
0 */6 * * * cd /path/to/project && npm run price-check:run -- --cooldown-minutes 360 --max-sources 50
```

## Playwright Note

Browser fallback exists for local dynamic-page scraping, but API tests mock browser collector behavior and do not launch a real browser.

For real local browser use, install Playwright browser binaries if needed:

```bash
npx playwright install
```

Browser fallback uses conservative timing settings:

- `BROWSER_TIMEOUT_MS`: navigation/body extraction timeout, default `15000`.
- `BROWSER_POST_LOAD_WAIT_MS`: extra wait after page load/network idle to capture late XHR/fetch JSON responses, default `3000`.

## Main API Groups

- Properties: create, list, get, update, delete properties.
- Property sources: attach external source URLs and metadata to properties.
- Watch lists/items: manually track properties, URLs, budgets, move-in targets, and notes. Use `GET /api/watch-items/:id/tracking-summary` for a read-only per-item tracking summary, and `GET /api/watch-items/tracking-summary` for paginated read-only overview cards.
- Price check runner: manually trigger run-all price checks with `POST /api/price-check/run-all`, including dry-run, cooldown, force, and max-source controls. Inspect run history with `GET /api/price-check/runs`, and review watch list health with `GET /api/price-check/health`.
- Scrape tasks/runs: create scrape tasks, run them, and inspect scrape run records.
- Price snapshots/history/latest price: store historical snapshots and read latest or chronological price data.
- Alerts: list stored alerts and mark alerts as read.

Use the one-shot local CLI runner for cron-friendly price checks.

## Admin Dashboard (Phase 7G)

The minimal local admin dashboard is under `frontend/`.

Current dashboard coverage:

- health summary panel (`GET /api/price-check/health`)
- watch items overview table (`GET /api/watch-items/tracking-summary`)
- recent run history panel (`GET /api/price-check/runs`)
- run controls (`POST /api/price-check/run-all`) with:
  - `dryRun`
  - `cooldownMinutes`
  - `maxSources`
  - `force`
- per-watch-item tracking detail (`GET /api/watch-items/:id/tracking-summary`)
- loading, empty, and error states with retry buttons

No authentication, maps, AI features, or new scraping behavior is added in this phase.

### Manual Dashboard Test Steps

Because this repo did not previously have frontend test setup, Phase 7G and Phase 7H use manual dashboard checks. Keep the frontend and backend running separately, and set `VITE_API_BASE_URL` if the backend is not available at `http://localhost:3000`:

1. Start backend: `npm run dev`
2. Start frontend: `npm run frontend:dev`
3. Open the Vite URL in browser (usually `http://localhost:5173`).
4. Confirm health summary loads.
5. Confirm watch item overview loads (or empty state appears).
6. Click `Run Price Check` and verify recent runs and health refresh.
7. Click `Dry Run` and verify run executes without scraper execution side effects.
8. Click a watch item row and verify detail panel fetches and renders.
9. Force a backend/API error (for example stop backend) and confirm error state and retry behavior.

## Scraping Pipeline

The scraper pipeline is intentionally conservative:

1. DIRECT_JSON runs first only when `PropertySource.metadata.preferredDirectJsonEndpoint` exists.
2. HTTP collection runs next using plain fetch and the generic HTML rent parser.
3. Browser fallback runs only after HTTP succeeds but no rent is parsed.
4. Browser fallback can capture likely rent/availability JSON endpoint candidates and save them to `PropertySource.metadata`.
5. Price snapshots, effective rent calculation, duplicate suppression, and alerts reuse the existing shared pipeline.

The generic parsers should not create fake price data when rent is not present.

## Watch Item Tracking Summary

Read a single watch item's tracking summary:

```http
GET /api/watch-items/:id/tracking-summary
```

The response includes the watch item and property basics, latest price snapshot or `null`, unread alert count, latest relevant alert, last check timestamps, source health, and a bounded recent results list. Alerts include direct watch-item alerts plus property-level alerts for that watch item's property; the latest direct watch-item alert is preferred, with property-level alerts used as fallback. This endpoint is read-only and does not create alerts, snapshots, scrape runs, or price-check results.

Read dashboard-ready tracking cards for multiple watch items:

```http
GET /api/watch-items/tracking-summary?status=WATCHING&limit=50&offset=0
```

The overview response includes `generatedAt`, `total`, `limit`, `offset`, and `items`. Each item includes latest price, budget status, unread alert count and latest alert, tracking status, and aggregate source health status. Supported filters are `status`, `needsReview`, `hasUnreadAlerts`, `withinBudget`, `limit`, and `offset`; `limit` defaults to `50` and is capped at `100`. This endpoint is read-only and does not create alerts, snapshots, scrape runs, or price-check runs.

## Future Phases

- Phase 6: domain-specific parsers for common apartment platforms.
- Phase 7: Google Places and map discovery after the Phase 7A-7H price-check and dashboard work.
- Phase 8: reviews, social, and forum data.
- Phase 9: AI, pgvector, semantic search, and agent research.
- Phase 10: scoring and recommendations.

See [docs/roadmap.md](docs/roadmap.md) for the long-term roadmap.
