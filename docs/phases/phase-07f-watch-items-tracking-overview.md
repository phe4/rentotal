# Phase 7F: Watch Items Tracking Overview API

## Goal

Add a list-level tracking overview API for watch items.

Phase 7E added a detailed per-watch-item tracking summary endpoint. Phase 7F should add a lightweight overview endpoint that returns dashboard-ready tracking cards for multiple watch items.

This phase should not add a frontend.

## In Scope

- `GET /api/watch-items/tracking-summary`
- overview cards for watch items
- optional filters
- latest price per watch item
- unread alert count
- latest alert
- last checked time
- needs-review state
- source health status
- budget status
- bounded/paginated response
- tests with local/in-memory behavior
- README/API docs update

## Out of Scope

Do not implement:

- frontend dashboard
- charts
- notification delivery
- scheduler/daemon/cloud cron
- new scraping behavior
- Google Places/maps
- AI features
- Yardi/new parsers
- profile lifecycle changes
- real external website tests
- stealth/proxy/CAPTCHA behavior

## API Endpoint

Add:

```http
GET /api/watch-items/tracking-summary
```

Suggested query params:

```text
status=WATCHING
needsReview=true
hasUnreadAlerts=true
withinBudget=true
limit=50
offset=0
```

Implement only the filters that fit the existing code cleanly. At minimum:

- `status`
- `limit`
- `offset`

## Response Shape

Suggested response:

```ts
type WatchItemsTrackingOverviewResponse = {
  generatedAt: string;
  total: number;
  limit: number;
  offset: number;
  items: Array<{
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
      baseRent?: number | null;
      effectiveRent?: number | null;
      availabilityStatus?: string | null;
      scrapedAt?: string | null;
      createdAt: string;
    } | null;

    budgetStatus: {
      targetBudgetMax?: number | null;
      effectiveRent?: number | null;
      withinBudget: boolean | null;
      amountBelowBudget?: number | null;
      amountAboveBudget?: number | null;
    };

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

    sourceHealthStatus: {
      usableSources: number;
      unhealthySources: number;
      needsReviewSources: number;
      hasUsableSource: boolean;
      overallStatus:
        | "OK"
        | "NEEDS_REVIEW"
        | "NO_USABLE_SOURCE"
        | "FAILING"
        | "UNKNOWN";
    };
  }>;
};
```

Exact fields can adapt to existing types.

## Budget Status Rules

For each item:

- if no latest effective rent or no targetBudgetMax, `withinBudget` should be null
- if effectiveRent <= targetBudgetMax, `withinBudget = true`
- if effectiveRent > targetBudgetMax, `withinBudget = false`
- amountBelowBudget = targetBudgetMax - effectiveRent when within budget
- amountAboveBudget = effectiveRent - targetBudgetMax when over budget

Do not create alerts in this endpoint.

## Source Health Overall Status

Suggested rules:

- `NO_USABLE_SOURCE`: no usable source exists
- `NEEDS_REVIEW`: one or more usable sources need review
- `FAILING`: latest relevant check failed and no newer success exists
- `OK`: at least one usable source has recent success and no needs-review condition dominates
- `UNKNOWN`: no run history yet

Keep this deterministic and simple.

## Pagination Rules

Use `limit` and `offset`.

Defaults:

- limit = 50
- offset = 0

Validation:

- limit must be positive
- offset must be >= 0
- cap max limit, for example 100

## Reuse Phase 7E Logic

Prefer reusing `WatchItemTrackingSummaryService` or extracting shared helper functions so Phase 7F does not duplicate complex aggregation logic.

Do not create N+1 database behavior if easy to avoid, but do not over-optimize prematurely.

## Testing

Add tests for:

1. overview endpoint returns list of watch item tracking cards.
2. status filter works.
3. limit/offset pagination works.
4. invalid limit/offset returns 400.
5. budgetStatus within budget.
6. budgetStatus over budget.
7. budgetStatus null when no budget or no latest price.
8. sourceHealthStatus returns NO_USABLE_SOURCE.
9. sourceHealthStatus returns NEEDS_REVIEW.
10. sourceHealthStatus returns FAILING.
11. sourceHealthStatus returns OK.
12. unread alert count and latest alert are included.
13. endpoint is read-only and does not create alerts/snapshots/scrape runs.
14. existing Phase 1–7E tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7F is complete when:

- `GET /api/watch-items/tracking-summary` exists
- endpoint returns paginated tracking cards
- endpoint supports basic status filter
- endpoint includes latest price summary
- endpoint includes budget status
- endpoint includes alert summary
- endpoint includes tracking status
- endpoint includes source health status
- endpoint is read-only
- tests use local/in-memory behavior only
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
