# Phase 7H: Frontend Hardening and API Client Cleanup

## Goal

Harden the minimal admin dashboard frontend added in Phase 7G.

Phase 7G intentionally kept the frontend simple. Phase 7H should improve maintainability without adding major new features.

This phase should prepare the dashboard for future UI expansion.

## In Scope

- frontend API client module
- shared frontend API response types
- API base URL helper
- clearer error handling
- cleaner loading/empty states
- split large frontend components if needed
- keep dashboard behavior equivalent
- frontend build script remains working
- README frontend config improvements
- manual verification checklist improvements
- tests only if lightweight and already practical

## Out of Scope

Do not implement:

- authentication
- user accounts
- maps
- Google Places
- AI features
- charts library
- new scraping behavior
- new platform parsers
- Yardi profile
- profile lifecycle changes
- notification delivery
- payment
- heavy UI library
- design system overhaul
- major visual redesign
- backend schema changes
- real external website tests

## Frontend Structure

If the current frontend is mostly in `App.tsx`, split only when helpful.

Suggested structure:

```text
frontend/src/
  api/
    client.ts
    types.ts
  components/
    HealthSummaryPanel.tsx
    WatchItemsOverviewTable.tsx
    RecentRunsPanel.tsx
    RunPriceCheckControls.tsx
    WatchItemTrackingDetail.tsx
  App.tsx
  styles.css
```

Do not over-split tiny components.

## API Client

Create a small API client wrapper for existing dashboard APIs:

```text
GET /api/price-check/health
GET /api/price-check/runs
GET /api/watch-items/tracking-summary
GET /api/watch-items/:id/tracking-summary
POST /api/price-check/run-all
```

Rules:

- use `VITE_API_BASE_URL`
- default to same-origin or documented local backend behavior
- handle non-2xx responses consistently
- return typed responses where practical
- keep implementation simple
- do not add axios or other HTTP libraries unless already installed

## Configuration

Clarify:

```text
VITE_API_BASE_URL=http://localhost:3000
```

Rules:

- no Vite proxy is configured unless explicitly added later
- frontend dev server and backend server run separately
- README should explain how to run both

## Error Handling

Improve API error handling so failed requests show useful messages.

At minimum:

- health summary fetch error
- overview fetch error
- recent runs fetch error
- detail fetch error
- run-all failure

Do not add global toast system unless simple and dependency-free.

## Dashboard Behavior

Preserve Phase 7G behavior:

- health summary panel
- watch items overview
- recent runs panel
- run price check button
- dry run button
- cooldownMinutes input
- maxSources input
- force checkbox
- selected watch item detail
- loading states
- empty states
- error states
- retry behavior

## Testing

If a frontend test framework already exists, add focused tests for the API client.

If no frontend test setup exists, do not add heavy test dependencies in this phase.

At minimum:

- frontend build must pass
- backend tests must pass
- README manual verification steps must be clear

## Acceptance Criteria

Phase 7H is complete when:

- frontend API client exists
- frontend API response types are centralized where practical
- dashboard still uses the same backend APIs
- dashboard behavior remains equivalent to Phase 7G
- error handling is clearer
- frontend build passes
- backend tests still pass
- README explains frontend API base URL and manual verification
- no auth/maps/AI/new scraping/parser/profile behavior is added
- lint, format, profile validation, backend tests, Prisma generate, Prisma validate, and frontend build pass
