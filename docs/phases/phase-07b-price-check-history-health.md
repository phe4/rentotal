# Phase 7B: Price Check Run History and Watch List Health Summary

## Goal

Add run history and health summary APIs for the price check workflow.

Phase 7A added a manual run-all worker that can check active watch list sources. Phase 7B should make those runs observable by storing or deriving run history and exposing health summary endpoints.

This phase should not add UI, real background scheduling, cloud deployment, or notification delivery.

## In Scope

- price check run history
- price check run detail
- watch list health summary
- last run timestamp
- success/failure/needs-review counts
- watch items without usable sources
- sources with recent failures
- sources with latest successful run
- API endpoints for run history and health
- tests with mocked/local scrape execution
- documentation updates

## Out of Scope

Do not implement:

- cloud scheduler deployment
- daemon/background service
- persistent queue system
- frontend dashboard
- email/SMS/push notifications
- Google Places/maps
- AI features
- new platform parsers
- Yardi profile
- new profile lifecycle work
- new scraping behavior
- real external website tests
- stealth/proxy/CAPTCHA behavior

## Recommended Data Model

If current data model does not persist run-all summaries, add lightweight models:

PriceCheckRun:

- id
- startedAt
- finishedAt nullable
- status enum or string:
  - SUCCEEDED
  - PARTIAL
  - FAILED
- watchItemsScanned
- sourcesSelected
- sourcesSucceeded
- sourcesFailed
- sourcesNeedsReview
- createdAt

PriceCheckRunResult:

- id
- priceCheckRunId
- propertyId nullable
- sourceId nullable
- scrapeRunId nullable
- status
- crawlerTier nullable
- itemsFound nullable
- errorMessage nullable
- createdAt

If the existing schema already has equivalent models, reuse them.

Do not redesign ScrapeRun.

## API Endpoints

Add:

### GET /api/price-check/runs

Returns recent price check run summaries.

Optional query params if easy:

- limit
- status

### GET /api/price-check/runs/:id

Returns one price check run and its result rows.

### GET /api/price-check/health

Returns current watch list tracking health.

Suggested response shape:

```ts
type PriceCheckHealthSummary = {
  generatedAt: string;
  lastRunAt?: string;
  activeWatchItems: number;
  watchItemsWithoutSources: number;
  usableSources: number;
  sourcesWithRecentSuccess: number;
  sourcesWithRecentFailure: number;
  sourcesNeedingReview: number;
  recentRuns: Array<{
    id: string;
    startedAt: string;
    status: string;
    sourcesSelected: number;
    sourcesSucceeded: number;
    sourcesFailed: number;
    sourcesNeedsReview: number;
  }>;
  issues: Array<{
    type: string;
    propertyId?: string;
    watchListItemId?: string;
    sourceId?: string;
    message: string;
  }>;
};
```

Exact fields may adapt to existing repository types.

## Health Rules

Health summary should identify:

### Active watch items

Only count watch list items with status WATCHING.

### Watch items without usable sources

A WATCHING item has no usable source when its property has no source with:

- sourceType FLOORPLAN_URL, OFFICIAL_SITE, or OTHER
- valid http/https sourceUrl

### Usable sources

Sources selected by the same rules as Phase 7A.

### Recent success/failure

Use recent PriceCheckRunResult or ScrapeRun data.

A source has recent success if its latest relevant result succeeded.

A source has recent failure if its latest relevant result failed.

### Needs review

A source needs review if its latest relevant result is PARTIAL/NEEDS_REVIEW or produced no parseable items.

Keep this logic simple and deterministic.

## Run-All Integration

Update Phase 7A run-all flow so each run persists:

- one PriceCheckRun row
- one PriceCheckRunResult row per selected source

The API response can still return the summary as before.

If one source fails, the overall PriceCheckRun should be PARTIAL unless all sources fail.

## Testing

Add tests for:

1. run-all persists a PriceCheckRun.
2. run-all persists result rows for selected sources.
3. GET /api/price-check/runs lists recent runs.
4. GET /api/price-check/runs/:id returns run details.
5. health summary counts active WATCHING items.
6. health summary reports watch items without usable sources.
7. health summary counts usable sources.
8. health summary includes recent run summaries.
9. health summary flags recent failures.
10. health summary flags needs-review sources.
11. inactive watch items are not counted as active.
12. existing Phase 1-7A tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7B is complete when:

- run-all persists run history
- run-all persists per-source results
- run history list endpoint exists
- run detail endpoint exists
- health summary endpoint exists
- health summary identifies watch items without usable sources
- health summary identifies recent failures and needs-review sources
- tests use mocks/local behavior only
- docs explain run history and health APIs
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
