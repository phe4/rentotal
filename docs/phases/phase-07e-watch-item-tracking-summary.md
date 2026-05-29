# Phase 7E: Watch Item Tracking Summary API

## Goal

Add a per-watch-item tracking summary API.

The user should be able to inspect a single watch item and understand:

- latest price
- latest effective rent
- latest availability
- last checked time
- last successful check
- last failed check
- unread alerts
- source health
- needs-review state
- recent tracking status

This phase should not add UI. It should provide an API that future UI can use.

## In Scope

- tracking summary service or repository helper
- `GET /api/watch-items/:id/tracking-summary`
- latest price snapshot for the watch item property
- latest alert / unread alert count
- last checked time
- last successful check time
- last failed check time
- source-level health summaries
- needs-review indicator
- recent price check results related to the watch item property/sources
- tests with local/in-memory behavior
- README/API docs update

## Out of Scope

Do not implement:

- frontend dashboard
- charts
- email/SMS/push notifications
- cloud scheduler
- daemon/background process
- Google Places/maps
- AI features
- new platform parsers
- Yardi profile
- new profile lifecycle work
- new scraping behavior
- real external website tests
- stealth/proxy/CAPTCHA behavior

## API Endpoint

Add:

```http
GET /api/watch-items/:id/tracking-summary
```

Suggested response shape:

```ts
type WatchItemTrackingSummary = {
  watchItemId: string;
  propertyId: string;
  watchItemStatus: string;
  propertyName?: string;
  targetBudgetMax?: number | null;

  latestPrice: {
    snapshotId: string;
    sourceId?: string | null;
    floorplanName?: string | null;
    unitNumber?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqft?: number | null;
    baseRent?: number | null;
    effectiveRent?: number | null;
    moveInDate?: string | null;
    availabilityStatus?: string | null;
    specialOfferText?: string | null;
    scrapedAt?: string | null;
    createdAt: string;
  } | null;

  alertSummary: {
    unreadCount: number;
    latestAlert?: {
      id: string;
      alertType: string;
      severity: string;
      title: string;
      message: string;
      createdAt: string;
      isRead: boolean;
    } | null;
  };

  trackingStatus: {
    lastCheckedAt?: string | null;
    lastSuccessfulCheckAt?: string | null;
    lastFailedCheckAt?: string | null;
    needsReview: boolean;
    lastErrorMessage?: string | null;
  };

  sourceHealth: Array<{
    sourceId: string;
    sourceType: string;
    sourceUrl?: string | null;
    isUsable: boolean;
    lastRunStatus?: string | null;
    lastCrawlerTier?: string | null;
    lastCheckedAt?: string | null;
    itemsFound?: number | null;
    needsReview: boolean;
    errorMessage?: string | null;
  }>;

  recentResults: Array<{
    priceCheckRunId?: string | null;
    scrapeRunId?: string | null;
    sourceId?: string | null;
    status: string;
    crawlerTier?: string | null;
    itemsFound?: number | null;
    errorMessage?: string | null;
    createdAt: string;
  }>;
};
```

Exact fields can adapt to existing types.

## Latest Price Rules

Return the newest relevant `PriceSnapshot` for the watch item's property.

Use existing latest price logic if available.

If no snapshot exists, return `latestPrice: null`.

## Alert Rules

For the watch item:

- count unread alerts linked directly to the watch item
- include latest alert linked to the watch item when present
- if existing alerts are property-level only, include property-level alerts as fallback if appropriate and documented

Do not create new alerts in this endpoint.

## Tracking Status Rules

Use recent `PriceCheckRunResult` and/or `ScrapeRun` records for sources belonging to the watch item property.

- `lastCheckedAt`: latest check attempt time
- `lastSuccessfulCheckAt`: latest successful check time
- `lastFailedCheckAt`: latest failed check time
- `needsReview`: true if latest relevant result is partial/needs-review or itemsFound is 0
- `lastErrorMessage`: latest failure or needs-review message if present

Keep logic deterministic and simple.

## Source Health Rules

For each property source:

- mark usable when sourceType is FLOORPLAN_URL, OFFICIAL_SITE, or OTHER and sourceUrl is valid http/https
- include latest result for that source if available
- needsReview true when latest result is partial/needs-review or itemsFound is 0
- unsupported or missing URL sources should be included with isUsable false

## Recent Results

Return a small recent list, for example latest 5 or latest 10 relevant results.

Do not return unbounded history.

## Testing

Add tests for:

1. tracking summary returns watch item/property basics.
2. latestPrice is null when no snapshots exist.
3. latestPrice returns newest snapshot when snapshots exist.
4. unread alert count is included.
5. latest alert is included.
6. lastCheckedAt / success / failure timestamps are derived from recent results.
7. sourceHealth includes usable and unusable sources.
8. sourceHealth marks needsReview for itemsFound 0 or partial result.
9. recentResults is bounded.
10. missing watch item returns 404.
11. existing Phase 1–7D tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7E is complete when:

- `GET /api/watch-items/:id/tracking-summary` exists
- endpoint returns latest price summary
- endpoint returns alert summary
- endpoint returns tracking status
- endpoint returns source health
- endpoint returns bounded recent results
- missing watch item returns 404
- no new scraping behavior is added
- tests use local/mocked behavior only
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
