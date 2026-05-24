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

## Not Implemented Yet

These features are intentionally out of scope for the current implementation:

- maps
- Google Places
- AI calls or agent research
- embeddings or pgvector
- reviews/social/forum crawling
- scoring or recommendations
- frontend
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
- Watch lists/items: manually track properties, URLs, budgets, move-in targets, and notes.
- Scrape tasks/runs: create scrape tasks, run them, and inspect scrape run records.
- Price snapshots/history/latest price: store historical snapshots and read latest or chronological price data.
- Alerts: list stored alerts and mark alerts as read.

## Scraping Pipeline

The scraper pipeline is intentionally conservative:

1. DIRECT_JSON runs first only when `PropertySource.metadata.preferredDirectJsonEndpoint` exists.
2. HTTP collection runs next using plain fetch and the generic HTML rent parser.
3. Browser fallback runs only after HTTP succeeds but no rent is parsed.
4. Browser fallback can capture likely rent/availability JSON endpoint candidates and save them to `PropertySource.metadata`.
5. Price snapshots, effective rent calculation, duplicate suppression, and alerts reuse the existing shared pipeline.

The generic parsers should not create fake price data when rent is not present.

## Future Phases

- Phase 6: domain-specific parsers for common apartment platforms.
- Phase 7: Google Places and map discovery.
- Phase 8: reviews, social, and forum data.
- Phase 9: AI, pgvector, semantic search, and agent research.
- Phase 10: scoring and recommendations.

See [docs/roadmap.md](docs/roadmap.md) for the long-term roadmap.
