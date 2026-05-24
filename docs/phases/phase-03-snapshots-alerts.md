# Phase 3: Price Snapshots, Effective Rent, and Alerts

## Goal

Turn scraped price data into useful tracking information.

Phase 2 made the system able to run HTTP scrapes and create basic price snapshots. Phase 3 should make those snapshots useful by adding:

- effective rent calculation
- price history APIs
- latest price APIs
- change detection
- basic alert generation
- watch-list budget detection

This phase should not add new scraping methods.

## In Scope

- price snapshot normalization
- effective rent calculation
- price comparison against previous snapshots
- latest price API improvements
- price history API improvements
- alert creation after successful scrape
- alert creation for scrape failures or parse failures if not already covered
- ENTERED_BUDGET alert for watch list items
- basic alert read/list improvements if needed
- tests for price change and alert logic

## Out of Scope

Do not implement:

- Playwright
- browser scraping
- direct JSON endpoint discovery
- domain-specific parsers
- AI extraction
- embeddings
- pgvector
- vector search
- maps
- Google Places
- review crawling
- social/forum crawling
- scoring/recommendations
- frontend
- authentication
- payment
- complex notification delivery such as email/SMS/push

Alerts should be stored in the database only. Do not send real notifications.

## Effective Rent Rules

Create a small deterministic utility for effective rent.

Recommended function:

```ts
calculateEffectiveRent(input: {
  baseRent?: number | null;
  leaseTermMonths?: number | null;
  specialOfferValue?: number | null;
  mandatoryFees?: number | null;
}): number | null
```

Rules:

- If `baseRent` is missing, return null.
- If `leaseTermMonths` is missing or <= 0, default to base rent plus mandatory fees.
- `specialOfferValue` means total concession value over the lease, not monthly discount.
- `mandatoryFees` means monthly mandatory fees.
- Formula:

```text
effectiveRent =
  ((baseRent * leaseTermMonths - specialOfferValue) / leaseTermMonths)
  + mandatoryFees
```

- If `specialOfferValue` is missing, treat it as 0.
- If `mandatoryFees` is missing, treat it as 0.
- Round to 2 decimals.
- Do not allow negative effective rent; minimum should be 0.

## Snapshot Behavior

When saving parsed price items:

- compute effective rent if not provided by parser
- preserve parser-provided effective rent if present, unless clearly invalid
- save each parsed item as a `PriceSnapshot`
- keep historical snapshots; do not overwrite old snapshots

Optional but recommended:

- avoid creating duplicate snapshots if the latest snapshot for the same property/source/floorplan/unit has identical tracked values
- still create a `ScrapeRun` even if no new snapshot was needed

Tracked values for duplicate detection:

- floorplanName
- unitNumber
- bedrooms
- bathrooms
- sqft
- baseRent
- effectiveRent
- leaseTermMonths
- moveInDate
- specialOfferText
- specialOfferValue
- mandatoryFees
- availabilityStatus

## Alert Types

Use existing alert enum values:

- PRICE_DROPPED
- PRICE_INCREASED
- NEW_SPECIAL_OFFER
- SPECIAL_OFFER_CHANGED
- BECAME_AVAILABLE
- ENTERED_BUDGET
- SCRAPE_FAILED
- NEEDS_REVIEW

## Alert Rules

After a successful scrape creates or evaluates snapshots, compare the newest parsed item to the previous relevant snapshot for the same property/source/floorplan/unit.

Create alerts:

### PRICE_DROPPED

When effective rent decreases compared to previous snapshot.

Message should include:

- previous effective rent
- new effective rent
- floorplan/unit if available

### PRICE_INCREASED

When effective rent increases compared to previous snapshot.

Message should include:

- previous effective rent
- new effective rent
- floorplan/unit if available

### NEW_SPECIAL_OFFER

When previous snapshot had no special offer and new snapshot has one.

### SPECIAL_OFFER_CHANGED

When both previous and new snapshots have special offer text, and the text changed.

### BECAME_AVAILABLE

When previous availability was unavailable or missing and new availability indicates available.

### ENTERED_BUDGET

For active watch list items on the same property:

- if targetBudgetMax exists
- and latest effective rent is <= targetBudgetMax
- create alert

Avoid duplicate ENTERED_BUDGET alerts for the same watch item and same effective rent if an unread or recent identical alert already exists.

### SCRAPE_FAILED

When scrape fails due to HTTP error, invalid URL, or collector failure.

### NEEDS_REVIEW

When HTTP succeeds but parser finds no rent data.

## Alert Deduplication

Avoid creating duplicate alerts repeatedly for the same unchanged condition.

A simple MVP approach is acceptable:

- before creating an alert, check recent alerts for same property/watch item, same alert type, and same message
- if found, skip creating a duplicate

## API Endpoints

Improve or add:

- GET /api/properties/:id/latest-price
  Return the latest price snapshot for the property, or null.

- GET /api/properties/:id/price-history
  Return chronological snapshots for that property.

- GET /api/properties/:id/price-snapshots
  Keep existing endpoint if already present.

- GET /api/alerts
  Support optional filters if easy:
  - isRead
  - propertyId
  - alertType

- PATCH /api/alerts/:id/read
  Keep existing behavior.

Do not add real-time notification delivery.

## Testing

Add tests for:

1. effective rent calculation with base rent only.
2. effective rent calculation with lease term and concession.
3. effective rent calculation with mandatory fees.
4. price drop creates `PRICE_DROPPED` alert.
5. price increase creates `PRICE_INCREASED` alert.
6. new special offer creates `NEW_SPECIAL_OFFER` alert.
7. changed special offer creates `SPECIAL_OFFER_CHANGED` alert.
8. entered budget creates `ENTERED_BUDGET` alert for matching watch item.
9. no duplicate alert for unchanged repeated scrape.
10. scrape failure creates `SCRAPE_FAILED`.
11. parser no-rent partial result creates `NEEDS_REVIEW`.
12. latest price returns newest snapshot.
13. price history returns chronological snapshots.
14. existing Phase 1 and Phase 2 tests still pass.

Use mocked HTTP responses only. Do not hit real external websites.

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

Phase 3 is complete when:

- effective rent is calculated deterministically
- snapshots are preserved historically
- duplicate unchanged snapshots are avoided or clearly documented if not avoided
- latest price endpoint returns the newest snapshot
- price history endpoint returns chronological snapshots
- alerts are created for price changes, special offer changes, budget entry, failures, and needs-review cases
- duplicate alerts are avoided for unchanged repeated conditions
- tests use mocked HTTP only
- all previous Phase 1 and Phase 2 tests still pass
- lint, format, tests, Prisma generate, and Prisma validate pass
