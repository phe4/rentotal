# Rentotal

Rentotal is a backend-first rental/apartment Watch List and price tracking MVP. The current version stores manually added apartments, source URLs, watch list items, watch intakes, price snapshots, scrape task/run records, raw page records, alerts, and AI-ready documents without implementing browser scraping or AI.

## Current Phase

Current phase: Phase 3 - Price snapshots, effective rent, and alerts. Phase 0 + Phase 1 foundation and Phase 2 HTTP scraping are implemented, and Phase 3 price tracking/alerts is next/current.

Implemented now:

- TypeScript Express backend
- PostgreSQL + Prisma schema
- manual properties and property sources
- watch lists, watch list items, and watch intakes
- placeholder price snapshot, scrape task/run, alert, document, and document chunk models
- Phase 2 HTTP scraper foundation with conservative generic rent parsing
- Phase 3 effective rent, price history, latest price, and stored alert logic
- raw page metadata and small raw text storage
- basic REST APIs and tests

Not implemented yet:

- browser scraping
- Playwright
- AI calls
- embeddings or pgvector
- maps or Google Places
- authentication
- frontend

## Setup

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env
```

Set `DATABASE_URL` to a PostgreSQL database.

## Database

Generate the Prisma client:

```bash
npm run prisma:generate
```

Create and apply a migration:

```bash
npm run prisma:migrate -- --name init
```

## Development

Run the API:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

Health check:

```text
GET /health
```

## Tests

Run tests:

```bash
npm test
```

Run the TypeScript checker:

```bash
npm run lint
```

Format files:

```bash
npm run format
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `PORT`: API port. Defaults to `3000`.

## API Summary

Properties:

- `POST /api/properties`
- `GET /api/properties`
- `GET /api/properties/:id`
- `PATCH /api/properties/:id`
- `DELETE /api/properties/:id`
- `POST /api/properties/:id/sources`
- `GET /api/properties/:id/sources`
- `DELETE /api/property-sources/:sourceId`
- `GET /api/properties/:id/price-snapshots`
- `GET /api/properties/:id/price-history`
- `GET /api/properties/:id/latest-price`

Watch lists and items:

- `GET /api/watch-lists`
- `POST /api/watch-lists`
- `GET /api/watch-lists/:id`
- `POST /api/watch-items`
- `GET /api/watch-items`
- `GET /api/watch-items/:id`
- `PATCH /api/watch-items/:id`
- `DELETE /api/watch-items/:id`

Watch intakes:

- `POST /api/watch-intakes`
- `GET /api/watch-intakes`
- `GET /api/watch-intakes/:id`

Alerts:

- `GET /api/alerts`
- `GET /api/alerts?isRead=false&propertyId=...&alertType=...`
- `PATCH /api/alerts/:id/read`

Scraping:

- `POST /api/scrape-tasks`
- `GET /api/scrape-tasks`
- `POST /api/scrape-tasks/:id/run`
- `POST /api/property-sources/:sourceId/scrape`
- `GET /api/scrape-runs`
- `GET /api/scrape-runs/:id`

## Future Phases

See [docs/roadmap.md](docs/roadmap.md) for the planned path from manual Watch List MVP to scraping, price history, alert generation, map discovery, AI research, semantic search, scoring, and recommendations.
