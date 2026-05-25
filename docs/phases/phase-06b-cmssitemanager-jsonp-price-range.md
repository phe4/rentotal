# Phase 6B: CmsSiteManager JSONP Adapter and HTML Price Range Fallback

## Goal

Add CmsSiteManager / Proxy/GetUnits JSONP support and conservative rendered HTML price range parsing.

Phase 6A added the parser registry and Knock/Doorway adapter. Phase 6A has been manually validated against Fairway Glen: the Knock/Doorway `/units` endpoint can be promoted to `preferredDirectJsonEndpoint`, used through `DIRECT_JSON`, parsed into `PriceSnapshot`, and can generate `ENTERED_BUDGET` alerts.

Phase 6B should not replace Knock/Doorway. It should improve data completeness and fallback coverage by adding another adapter.

## Why This Phase Exists

Manual inspection found that Fairway Glen also exposes richer unit data through a CmsSiteManager JSONP endpoint:

```text
/CmsSiteManager/callback.aspx?act=Proxy/GetUnits&...
```

It returns JSONP:

```text
jQueryCallback({
  "units": [...]
})
```

This endpoint includes useful fields that may be missing from Knock data, such as:

- floorplanName
- minLeaseTermInMonth
- internalAvailableDate
- mandatoryFeesDeposits
- totalRent
- unitLeasedStatus

The rendered HTML also includes floorplan-level price ranges such as:

```html
<div class="fp-price-range">
  <strong id="fp_1928508_range">$2,719 - $2,853</strong>
</div>
```

## In Scope

- JSONP unwrap utility
- CmsSiteManager / Proxy/GetUnits platform detection
- CmsSiteManager units parser
- Support JSONP in direct endpoint flow where appropriate
- Candidate detection/scoring for `callback.aspx?act=Proxy/GetUnits`
- Safe handling of JSONP callback and `_` cachebuster query params
- Conservative HTML price range parsing
- Reuse existing parser registry
- Reuse existing `ParsedPriceItem` shape
- Reuse existing snapshot/effective rent/alert/dedup pipeline
- Preserve existing Knock/Doorway adapter behavior
- Local sanitized fixtures only
- Tests with mocked HTTP/browser behavior only

## Out of Scope

Do not implement:

- replacing Knock/Doorway behavior
- Entrata parser
- Yardi parser
- Greystar parser
- additional platform parsers
- more Playwright features
- AI extraction
- embeddings
- pgvector
- Google Places
- maps
- review crawling
- social/forum crawling
- scoring/recommendations
- frontend
- authentication
- payment
- stealth plugins, proxies, CAPTCHA bypass, or anti-detection logic
- real external website calls in tests

## Architecture

Add or extend:

parsers/

- jsonpUtils.ts
- cmsSiteManagerParser.ts
- platformDetector.ts
- parserRegistry.ts
- genericHtmlRentParser.ts for conservative price range support

fixtures:

- test/fixtures/cmssitemanager/units.jsonp
- test/fixtures/cmssitemanager/no-rent-units.jsonp
- test/fixtures/cmssitemanager/floorplan-range.html

## Adapter Priority

Preserve existing Knock behavior.

Recommended parser/adapter priority:

1. Knock/Doorway parser when URL or JSON clearly matches Knock/Doorway
2. CmsSiteManager / Proxy/GetUnits parser when URL or JSONP clearly matches CmsSiteManager units
3. Generic JSONP unwrap + generic JSON parser
4. Generic JSON parser
5. HTML price range parser
6. Generic HTML parser

Do not remove generic fallback.

## Detection Rules

Detect CmsSiteManager / Proxy/GetUnits when:

- URL path includes `/CmsSiteManager/callback.aspx`
- query param `act=Proxy/GetUnits`
- response is JSONP containing a root object with `units`
- unit objects contain fields such as:
  - unitNumber
  - floorplanName
  - numberOfBeds
  - numberOfBaths
  - squareFeet
  - rent
  - mandatoryFeesDeposits

## JSONP Rules

Implement a conservative JSONP unwrap utility.

Rules:

- Accept strings shaped like:
  - `callback({...})`
  - `jQuery123({...});`

- Extract the JSON object/array inside the outer callback.
- Parse it safely with `JSON.parse`.
- Reject invalid JSONP.
- Do not execute JavaScript.
- Do not use `eval`.
- Do not use `Function`.
- Return null or throw a controlled parser error on invalid input.

## CmsSiteManager Parser Mapping

For each unit in `units`, map:

- floorplanName = unit.floorplanName
- unitNumber = unit.unitNumber or unit.name
- bedrooms = Number(unit.numberOfBeds)
- bathrooms = Number(unit.numberOfBaths)
- sqft = Number(unit.squareFeet)
- baseRent = Number(unit.rent)
- leaseTermMonths = Number(unit.minLeaseTermInMonth)
- moveInDate = unit.internalAvailableDate
- mandatoryFees = Number(unit.mandatoryFeesDeposits)
- availabilityStatus = unit.unitLeasedStatus or unit.leaseStatus
- rawData = sanitized unit object

Important:

- Preserve `totalRent` in rawData for reference.
- Do not use `totalRent` as baseRent.
- Existing effective rent utility should calculate effectiveRent.

Only create `ParsedPriceItem` when `rent` is a valid numeric rent value.

## Endpoint Promotion Rules

`CmsSiteManager/callback.aspx?act=Proxy/GetUnits` can become a candidate or preferred direct endpoint when:

- it is identified as Proxy/GetUnits
- JSONP unwrap succeeds
- units parser returns at least one item with valid rent

However, do not demote or overwrite an already working preferred Knock/Doorway `/units` endpoint unless there is a clear reason.

If both Knock `/units` and CmsSiteManager `Proxy/GetUnits` are available:

- keep the existing preferred endpoint stable
- store CmsSiteManager as an additional high-confidence candidate
- future enrichment can compare fields across sources

Normalize endpoint metadata:

- preserve important query params like `siteid`, `bestprice`, `leaseterm`, `dateneeded`, `available`
- ignore or strip volatile query params like:
  - `callback`
  - `_`

Do not store cookies, auth tokens, or sensitive headers.

## HTML Price Range Parsing

Extend generic HTML parsing conservatively to support floorplan-level price ranges:

Supported patterns:

- `$2,719 - $2,853`
- `$2719 - $2853`
- `Starting at $2,719`
- `From $2,719`

Rules:

- Use the lower value as baseRent.
- If both min and max exist, preserve maxRent in rawData.
- Do not parse unrelated dollar amounts such as fees/deposits if context suggests non-rent.
- Keep this conservative.

## Testing

Add tests for:

1. JSONP unwrap parses valid callback JSON.
2. JSONP unwrap rejects invalid JSONP without eval.
3. CmsSiteManager parser maps units JSONP into `ParsedPriceItem`.
4. CmsSiteManager parser uses `rent` as baseRent and `mandatoryFeesDeposits` as mandatoryFees.
5. `totalRent` is preserved in rawData but does not replace baseRent.
6. no-rent units JSONP creates no snapshots.
7. Proxy/GetUnits endpoint can be stored as a high-confidence candidate after successful parse.
8. Existing preferred Knock `/units` endpoint is not overwritten by CmsSiteManager candidate.
9. volatile `callback` and `_` params are stripped or normalized in metadata.
10. HTML price range parser extracts lower rent from `$2,719 - $2,853`.
11. Existing Knock/Doorway tests still pass.
12. Generic parser fallback remains intact.
13. Existing Phase 1–6A tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 6B is complete when:

- JSONP unwrap utility exists and is safe
- CmsSiteManager parser handles mocked `Proxy/GetUnits` JSONP
- valid units JSONP creates `ParsedPriceItem`
- parsed items can feed existing snapshot/effective rent/alert pipeline
- Proxy/GetUnits can be stored as a high-confidence candidate
- existing preferred Knock endpoint is preserved
- HTML price range parsing works conservatively
- Knock/Doorway Phase 6A behavior remains intact
- all tests pass
- lint, format, tests, Prisma generate, and Prisma validate pass

```

```
