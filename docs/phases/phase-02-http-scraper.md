# Phase 2: HTTP Scraper Foundation

## Goal

Add the first real scraping foundation using plain HTTP fetch and a conservative generic HTML parser.

This phase should make the system capable of:

- creating scrape tasks
- running one HTTP scrape for a property source
- recording scrape runs
- saving raw page metadata or small raw text
- parsing simple static HTML rent patterns
- creating price snapshots when parsing succeeds
- failing gracefully when parsing fails

## In Scope

- HTTP collector
- generic HTML rent parser
- parser interface
- scrape service
- scrape task APIs
- scrape run APIs
- convenience endpoint to scrape one property source
- RawPage model if it does not already exist
- mocked HTTP tests
- documentation updates

## Out of Scope

Do not implement:

- Playwright
- browser scraping
- dynamic JavaScript rendering
- direct JSON endpoint discovery
- Zillow scraping
- Apartments.com scraping
- Google Maps scraping
- Google Places
- maps
- AI extraction
- embeddings
- pgvector
- vector search
- review crawling
- social/forum crawling
- scoring/recommendations
- frontend
- authentication
- alert diff logic beyond storing scrape errors if needed

## Architecture

The scraping module should be split into:

collectors/

- httpCollector.ts

parsers/

- priceParser.ts
- genericHtmlRentParser.ts

services/

- scrapeService.ts

The design should allow future phases to add:

- Playwright collector
- direct JSON collector
- domain-specific parsers
- AI extraction fallback

## Suggested Types

```ts
export type CollectedPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  contentHash: string;
};

export type ParsedPriceItem = {
  floorplanName?: string;
  unitNumber?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  baseRent?: number;
  effectiveRent?: number;
  leaseTermMonths?: number;
  moveInDate?: string;
  specialOfferText?: string;
  specialOfferValue?: number;
  mandatoryFees?: number;
  availabilityStatus?: string;
  rawData?: unknown;
};

export interface PriceParser {
  name: string;
  parse(input: {
    url: string;
    text: string;
    contentType?: string;
  }): ParsedPriceItem[];
}
```

## Generic Parser Rules

The generic parser must be conservative.

It may parse:

- `$2,500`
- `$2500`
- `$2,500/mo`
- `Rent: $2,500`
- `Starting at $2,500`
- `1 Bed`
- `1 Bath`
- `1BR`
- `1 BA`
- `750 sq ft`
- `6 weeks free`
- `1 month free`

It must not hallucinate rent when no price exists.

If no rent is found:

- return an empty parsed result
- do not create a PriceSnapshot
- mark the scrape run as failed or partial with a clear message

## Data Model

Use existing Prisma models where possible.

If no raw page model exists, add:

RawPage:

- id
- scrapeRunId nullable
- propertyId nullable
- sourceId nullable
- url
- contentType nullable
- contentHash nullable
- rawText nullable
- rawJson Json nullable
- rawHtmlStorageUrl nullable
- createdAt

Raw text should be trimmed/sanitized. Do not store huge HTML blindly.

Future large raw HTML should move to object storage.

## API Endpoints

Add:

- POST /api/scrape-tasks
  Creates a ScrapeTask for a property/source.

- GET /api/scrape-tasks
  Lists scrape tasks.

- POST /api/scrape-tasks/:id/run
  Runs one scrape task.

- POST /api/property-sources/:sourceId/scrape
  Convenience endpoint to run an HTTP scrape for one source.

- GET /api/scrape-runs
  Lists recent scrape runs.

- GET /api/scrape-runs/:id
  Gets one scrape run and related parsed snapshot info if practical.

## Scrape Behavior

When running a scrape:

1. Load the source.
2. Validate `sourceUrl` exists and is `http` or `https`.
3. Create or update `ScrapeTask` / `ScrapeRun` status.
4. Fetch the URL using plain HTTP fetch.
5. Compute `contentHash`.
6. Save `RawPage` if the model exists.
7. Run `genericHtmlRentParser`.
8. If parsed rent items exist:
   - create `PriceSnapshot` rows
   - set `PriceSnapshot.parseStatus = PARSED`
   - set `ScrapeRun.status = SUCCEEDED`
   - set `ScrapeRun.itemsFound = parsed item count`

9. If no parsed rent items exist:
   - do not create `PriceSnapshot`
   - set `ScrapeRun.status = PARTIAL` or `FAILED`
   - store an error/parse message

10. If HTTP fetch fails:

- set `ScrapeRun.status = FAILED`
- store `errorMessage`
- do not throw uncaught errors from route

## Testing

Use mocked HTTP responses only.

Do not hit real external websites in tests.

Add tests for:

1. Creating a scrape task.
2. Running a scrape task with mocked static HTML containing rent creates a `ScrapeRun` and `PriceSnapshot`.
3. Running source scrape with no rent creates a `ScrapeRun` but no `PriceSnapshot`.
4. Invalid source URL fails gracefully.
5. HTTP failure creates a failed `ScrapeRun`.
6. Generic parser extracts a simple rent amount.
7. Generic parser does not hallucinate rent when no price exists.
8. Existing Phase 1 tests still pass.

## Constraints

- Do not install Playwright.
- Do not add AI dependencies.
- Do not add embeddings or pgvector.
- Do not implement maps or Google Places.
- Do not implement review/social/forum crawling.
- Do not implement scoring or recommendations.
- Do not add authentication.
- Do not add frontend.
- Keep changes reviewable.
- Do not make broad refactors.

## Acceptance Criteria

Phase 2 is complete when:

- scrape tasks can be created and listed
- an HTTP scrape can run against a property source
- a scrape run is recorded for success and failure
- simple static rent HTML creates a price snapshot
- no-rent HTML does not create fake price data
- invalid URLs and HTTP failures are handled gracefully
- tests use mocked HTTP only
- all existing Phase 1 tests still pass
- lint, format, tests, Prisma generate, and Prisma validate pass
