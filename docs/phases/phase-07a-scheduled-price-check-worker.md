# Phase 7A: Scheduled Price Check Worker

## Goal

Add a local/manual price-check runner foundation that can later be called by cron, cloud scheduler, BullMQ, or Airflow.

Up to Phase 6H, the system can manually run scrapes, parse prices, create snapshots, generate alerts, and manage platform profiles. Phase 7A should make watch list tracking repeatable by adding a worker/service that can run price checks for active watch list items and their property sources.

This phase should not add cloud deployment or real cron infrastructure yet.

## In Scope

- local worker/service for running scheduled price checks
- manual run-all entrypoint for active watch list items
- optional CLI or API endpoint to trigger run-all
- find active watch list items with status WATCHING
- find associated property sources suitable for price checking
- create or execute PRICE_CHECK scrape tasks
- reuse existing scrapeService pipeline
- summarize run results
- prevent duplicate concurrent runs for the same source within one run
- tests with mocked scrape execution
- documentation for local/manual scheduled runs

## Out of Scope

Do not implement:

- cloud scheduler deployment
- background daemon process
- persistent queue system if not already present
- email/SMS/push notification delivery
- frontend dashboard
- Google Places/maps
- AI features
- new platform parsers
- Yardi profile
- DB-backed profiles
- profile generation/approval changes
- real external website tests
- stealth/proxy/CAPTCHA behavior

## Active Watch Item Rules

Only include watch list items with:

```text
status = WATCHING
```

Do not automatically scrape:

- ARCHIVED
- REJECTED
- LEASED
- APPLIED
- CONTACTED
- TOURED

Future phases may support per-status behavior, but not now.

## Source Selection Rules

For each active watch item:

- load its property
- load property sources
- choose sources with sourceType suitable for price checking:
  - FLOORPLAN_URL
  - OFFICIAL_SITE
  - OTHER if sourceUrl exists
- skip sources without sourceUrl
- skip non-http/https URLs
- avoid duplicate source IDs within the same run

Do not scrape Google Maps/Zillow/Apartments.com specially in this phase.

## Execution Rules

For each selected source:

1. create or reuse a PRICE_CHECK scrape task
2. run the existing scrapeService logic
3. collect result:
   - sourceId
   - propertyId
   - scrapeRunId
   - status
   - crawlerTier
   - itemsFound
   - errorMessage if any

The worker should not implement new scraping logic.

## Run Summary

Return a summary:

```ts
type ScheduledPriceCheckSummary = {
  startedAt: string;
  finishedAt: string;
  watchItemsScanned: number;
  sourcesSelected: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
  results: Array<{
    propertyId?: string;
    sourceId: string;
    scrapeRunId?: string;
    status: string;
    crawlerTier?: string;
    itemsFound?: number;
    errorMessage?: string;
  }>;
};
```

Exact fields can adapt to existing types.

## Trigger Options

Add one local/manual trigger.

Preferred options:

- CLI script: `npm run price-check:run`
- or API endpoint: `POST /api/price-check/run-all`

Choose the option that best matches the current project style.

Do not add a real scheduler dependency unless already present.

## Testing

Add tests for:

1. run-all selects only WATCHING watch list items.
2. archived/rejected/leased/applied/contacted/toured items are skipped.
3. source selection includes FLOORPLAN_URL and OFFICIAL_SITE.
4. sources without URL are skipped.
5. duplicate sources are only run once per run.
6. scrape execution is mocked or uses existing in-memory test pipeline.
7. summary counts successes/failures/needs-review.
8. run-all does not add new scraper behavior.
9. existing Phase 1-6H tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7A is complete when:

- local/manual price-check worker exists
- active WATCHING watch list items can be scanned
- valid property sources can be selected
- existing scrape pipeline is reused
- duplicate sources are avoided within one run
- run summary is returned
- tests use mocks/local behavior only
- docs explain how to trigger local price checks
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
