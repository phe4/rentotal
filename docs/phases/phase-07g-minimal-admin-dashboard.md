# Phase 7G: Minimal Admin Dashboard Frontend

## Goal

Add a minimal local admin dashboard frontend for the rental tracking system.

The backend now supports:

- watch list management
- scraping and price snapshots
- alerts
- price check run-all
- run history
- health summary
- watch item tracking summaries
- watch items tracking overview

Phase 7G should expose these existing backend capabilities through a simple dashboard.

This phase is not about visual polish. It is about making the system usable and inspectable.

## In Scope

- minimal frontend app or admin page
- watch items tracking overview page
- price check health summary panel
- recent price check runs panel
- run-all button
- dry-run button
- watch item tracking detail view
- unread alert display
- needs-review/source-health indicators
- loading and error states
- README instructions for running the dashboard
- tests if the frontend test setup exists or can be added lightly

## Out of Scope

Do not implement:

- authentication
- user accounts
- public customer-facing UI
- maps
- Google Places
- charts library
- AI features
- new scraping behavior
- new platform parsers
- Yardi profile
- profile lifecycle changes
- notification delivery
- payment
- complex responsive design
- design system overhaul
- real external website tests

## Frontend Approach

If the project already has a frontend framework, use the existing framework.

If there is no frontend, prefer a minimal Vite + React + TypeScript frontend unless the existing project structure suggests a better fit.

Keep the UI simple.

Suggested pages/components:

- AdminDashboardPage
- HealthSummaryPanel
- WatchItemsOverviewTable
- RecentRunsPanel
- WatchItemTrackingDetail
- RunPriceCheckControls

Do not over-engineer routing. A single dashboard page with a detail section is acceptable.

## API Usage

Use existing backend endpoints:

```http
GET /api/price-check/health
GET /api/price-check/runs
GET /api/watch-items/tracking-summary
GET /api/watch-items/:id/tracking-summary
POST /api/price-check/run-all
```

Run controls should support:

- dryRun
- cooldownMinutes
- maxSources
- force

## Dashboard Behavior

The dashboard should show:

### Health Summary

Display:

- active watch items
- watch items without usable sources
- usable sources
- sources with recent success
- sources with recent failure
- sources needing review
- latest run info if available

### Watch Items Overview

Display one row/card per watch item:

- property name
- watch item status
- latest effective rent
- budget status
- within/over budget
- unread alert count
- last checked time
- source health overall status
- needs-review flag

### Run Controls

Add buttons:

- Run price check
- Dry run

Allow simple inputs:

- cooldownMinutes
- maxSources
- force checkbox

After a run completes, refresh:

- health summary
- watch items overview
- recent runs

### Watch Item Detail

When selecting a watch item, show:

- latest price details
- alert summary
- tracking status
- source health list
- recent results

## Error and Loading States

Add basic:

- loading state
- empty state
- error state
- retry button if easy

Do not add global state management unless needed.

## Styling

Keep styling simple.

Acceptable options:

- plain CSS
- minimal CSS module
- existing styling setup if present

Do not add heavy UI libraries unless already installed.

## Testing

If a frontend test framework already exists, add tests for:

1. dashboard fetches health summary.
2. dashboard fetches watch items overview.
3. run-all button calls POST /api/price-check/run-all.
4. dry-run button sends dryRun true.
5. detail view fetches per-watch-item summary.
6. error state is displayed.

If no frontend test setup exists, do not add a heavy test framework in this phase. Instead, keep logic simple and document manual test steps.

Backend tests must still pass.

## Acceptance Criteria

Phase 7G is complete when:

- a minimal admin dashboard exists
- dashboard can display health summary
- dashboard can display watch items overview
- dashboard can trigger run-all
- dashboard can trigger dry-run
- dashboard can show recent runs
- dashboard can show per-watch-item detail
- loading/error/empty states exist
- README explains how to run the dashboard
- no auth/maps/AI/new scraping behavior is added
- backend tests still pass
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
