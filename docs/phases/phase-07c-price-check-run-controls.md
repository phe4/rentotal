# Phase 7C: Price Check Cooldown and Run Controls

## Goal

Add safe run controls to the manual price check workflow.

Phase 7A added `POST /api/price-check/run-all`.
Phase 7B added durable run history and health summary.

Phase 7C should make run-all safer and more controllable before any real scheduler is introduced.

## In Scope

- request options for run-all:
  - `dryRun`
  - `cooldownMinutes`
  - `force`
  - `maxSources`
- skipped source reporting
- skip reasons
- run summary updates
- health/run history compatibility
- tests with mocked/local scrape execution
- documentation updates

## Out of Scope

Do not implement:

- real scheduler/cron
- cloud scheduler
- background daemon
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

## Request Options

Extend `POST /api/price-check/run-all` to accept:

```ts
type RunAllOptions = {
  dryRun?: boolean;
  cooldownMinutes?: number;
  force?: boolean;
  maxSources?: number;
};
```

### dryRun

When `dryRun = true`:

- select eligible sources
- apply cooldown/maxSources logic
- return what would run
- do not create ScrapeTask
- do not call scrapeService
- do not create ScrapeRun
- do not create PriceCheckRunResult scrape outputs
- can create a PriceCheckRun record only if the existing design expects all run-all calls to be recorded, but prefer not to persist dry runs unless documented

### cooldownMinutes

When provided:

- skip sources whose latest successful or attempted price check is within the cooldown window
- use PriceCheckRunResult / ScrapeRun / existing run history as source of truth
- default can be omitted or 0 for no cooldown

### force

When `force = true`:

- bypass cooldown
- still respect valid source selection
- still respect maxSources unless documented otherwise

### maxSources

When provided:

- limit selected executable sources to at most maxSources
- skipped sources should be reported with reason `MAX_SOURCES_LIMIT`
- maxSources must be positive
- reject invalid values clearly

## Skip Reasons

Support skip reasons such as:

```text
NO_SOURCE_URL
INVALID_URL
UNSUPPORTED_SOURCE_TYPE
COOLDOWN_ACTIVE
MAX_SOURCES_LIMIT
DRY_RUN
DUPLICATE_SOURCE
```

Exact enum/string shape can adapt to existing types.

## Summary Updates

Extend summary to include:

```ts
type ScheduledPriceCheckSummary = {
  startedAt: string;
  finishedAt: string;
  dryRun?: boolean;
  watchItemsScanned: number;
  sourcesSelected: number;
  sourcesSkipped: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
  skipped: Array<{
    propertyId?: string;
    watchListItemId?: string;
    sourceId?: string;
    reason: string;
    message: string;
  }>;
  results: Array<...>;
};
```

Keep existing fields backward compatible.

## Persistence Rules

For normal runs:

- persist PriceCheckRun and PriceCheckRunResult as in Phase 7B
- include skipped count if schema supports it, or keep skipped only in response if avoiding schema changes

For dry runs:

- prefer no DB persistence
- do not create scrape tasks or scrape runs
- do not change alerts or snapshots

If schema change is needed for skipped count, keep it minimal.

## Cooldown Logic

A source should be considered recently checked if it has a recent PriceCheckRunResult or ScrapeRun within cooldownMinutes.

Use the latest result per source.

Cooldown applies to both success and failure attempts unless implementation has a clear reason to use success only.

## Testing

Add tests for:

1. dryRun returns eligible sources but does not call scrape execution.
2. dryRun does not create scrape tasks or scrape runs.
3. cooldown skips recently checked source.
4. force bypasses cooldown.
5. maxSources limits executed source count.
6. skipped sources include clear reasons.
7. invalid maxSources is rejected.
8. invalid cooldownMinutes is rejected.
9. duplicate source still skipped once.
10. normal run behavior from Phase 7A/7B still works.
11. existing Phase 1-7B tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7C is complete when:

- run-all accepts dryRun/cooldownMinutes/force/maxSources
- dryRun does not execute scrapes
- cooldown skips recently checked sources
- force bypasses cooldown
- maxSources limits run size
- skipped source reasons are returned
- normal run history still works
- health summary remains compatible
- tests use mocks/local behavior only
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
