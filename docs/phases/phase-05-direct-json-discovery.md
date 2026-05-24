# Phase 5: Direct JSON Endpoint Discovery

## Goal

Reduce repeated browser usage by discovering internal JSON endpoints during browser fallback.

Many apartment websites render prices dynamically, but the data often comes from XHR/fetch/GraphQL JSON responses. Phase 5 should detect likely rent/availability JSON responses during Playwright fallback, persist endpoint metadata, and support future direct JSON scraping.

This phase should make browser fallback smarter, but it should not become a full domain-specific parser project.

## In Scope

- Capture network responses during browser fallback
- Identify candidate JSON responses that may contain rent, floorplan, unit, availability, or concession data
- Store candidate endpoint metadata in `PropertySource.metadata`
- Add a direct JSON collector
- Add a conservative generic JSON rent parser
- Prefer direct JSON collector when a source already has a saved direct JSON endpoint
- Fall back to existing HTTP and browser pipeline if direct JSON fails
- Add tests with mocked JSON responses and mocked browser network candidates
- Keep existing snapshot, effective rent, alert, and dedup logic

## Out of Scope

Do not implement:
- domain-specific parsers for Entrata/Yardi/Greystar/etc.
- full GraphQL operation replay beyond basic captured endpoint metadata
- login/session/cookie replay beyond simple headers if already captured safely
- anti-detection, stealth plugins, proxy rotation, CAPTCHA bypass, or paywall/login bypass
- AI extraction
- embeddings
- pgvector
- vector search
- Google Places
- maps
- review crawling
- social/forum crawling
- scoring/recommendations
- frontend
- authentication
- payment
- email/SMS/push notifications

## Architecture

Add or extend:

collectors/
- directJsonCollector.ts
- browserCollector.ts network capture support

parsers/
- genericJsonRentParser.ts
- priceParser.ts may remain shared if appropriate

services/
- scrapeService.ts should orchestrate:
  1. direct JSON path if endpoint metadata exists
  2. HTTP path
  3. browser fallback path
  4. candidate endpoint persistence

## Metadata Shape

Store discovered endpoint candidates in `PropertySource.metadata`.

Recommended shape:

```json
{
  "directJsonCandidates": [
    {
      "url": "https://example.com/api/availability",
      "method": "GET",
      "contentType": "application/json",
      "confidence": 0.82,
      "reason": "JSON response contained rent and floorplan-like keys",
      "discoveredAt": "2026-05-24T00:00:00.000Z"
    }
  ],
  "preferredDirectJsonEndpoint": {
    "url": "https://example.com/api/availability",
    "method": "GET",
    "contentType": "application/json",
    "confidence": 0.82,
    "discoveredAt": "2026-05-24T00:00:00.000Z"
  }
}
````

Keep this flexible. Do not require a schema migration unless necessary.

## Candidate Detection Rules

A JSON response can be a candidate if:

* content-type includes `application/json`, or response body parses as JSON
* URL or JSON keys contain signals such as:

  * rent
  * price
  * pricing
  * floorplan
  * floorPlan
  * unit
  * apartment
  * availability
  * available
  * beds
  * baths
  * sqft
  * concession
  * special
  * lease

Candidate confidence should be conservative.

Avoid storing candidates for:

* analytics
* tracking
* ads
* maps
* fonts/images/media
* unrelated app config
* auth/session/user endpoints

Do not store sensitive headers, cookies, tokens, or personal data.

## Direct JSON Collector

If `PropertySource.metadata.preferredDirectJsonEndpoint` exists:

1. Try direct JSON collector first.
2. Fetch the endpoint using plain HTTP.
3. Parse JSON using generic JSON parser.
4. If successful, create snapshots and alerts using existing pipeline.
5. If direct JSON fails or finds no rent, fall back to existing HTTP path and browser fallback.

The direct JSON path should use crawler tier `DIRECT_JSON`.

## Generic JSON Parser Rules

The parser should be conservative and recursive.

It may extract rent items from JSON objects/arrays containing fields such as:

* rent
* price
* marketRent
* minRent
* maxRent
* floorplan
* floorPlanName
* unit
* unitNumber
* beds
* bedrooms
* baths
* bathrooms
* sqft
* squareFeet
* available
* availability
* moveInDate
* special
* concession

Rules:

* Only create ParsedPriceItem when a rent-like numeric field exists.
* Do not hallucinate rent from unrelated numbers.
* Prefer baseRent from clear rent/price fields.
* Capture rawData for the matched object.
* Return [] if confidence is low.

## Browser Network Capture

During browser fallback:

* listen to JSON responses
* inspect small/medium JSON bodies only
* avoid storing huge responses blindly
* collect candidate metadata
* optionally keep a small sanitized JSON sample in RawPage.rawJson if practical
* persist candidates to `PropertySource.metadata`

If browser rendered HTML parser succeeds but network candidates are found, still save candidates for future faster runs.

## ScrapeRun Behavior

When direct JSON path is used:

* create a ScrapeRun with crawlerTier `DIRECT_JSON`
* save RawPage with contentType application/json if practical
* create PriceSnapshot rows on parser success
* create NEEDS_REVIEW if JSON succeeds but no rent found
* create SCRAPE_FAILED if endpoint fetch fails

If direct JSON fails, continue to HTTP/browser fallback rather than failing the whole scrape immediately.

## Testing

Use mocked HTTP/browser behavior only.

Do not hit real external websites.

Add tests for:

1. direct JSON endpoint is used first when metadata has `preferredDirectJsonEndpoint`.
2. direct JSON parser creates PriceSnapshot from simple JSON rent data.
3. direct JSON no-rent response falls back to HTTP/browser path.
4. direct JSON HTTP failure falls back to HTTP/browser path.
5. browser fallback captures candidate JSON endpoint metadata.
6. candidate metadata excludes obvious analytics/tracking endpoints.
7. generic JSON parser does not hallucinate rent from unrelated numeric JSON.
8. existing Phase 1-4 tests still pass.

## Constraints

* Do not implement domain-specific parsers.
* Do not add AI dependencies.
* Do not add embeddings or pgvector.
* Do not implement maps or Google Places.
* Do not implement review/social/forum crawling.
* Do not implement scoring or recommendations.
* Do not add authentication.
* Do not add frontend.
* Do not add stealth/proxy/anti-detection logic.
* Do not store cookies, auth tokens, or sensitive headers.
* Keep changes reviewable.
* Do not make broad refactors.

## Acceptance Criteria

Phase 5 is complete when:

* browser fallback can capture candidate JSON endpoints
* candidate metadata is saved to `PropertySource.metadata`
* direct JSON collector can use saved endpoint metadata first
* generic JSON parser can extract simple rent data
* direct JSON failures gracefully fall back to existing HTTP/browser flow
* no sensitive headers/cookies/tokens are stored
* tests mock all network/browser behavior
* all previous tests still pass
* lint, format, tests, Prisma generate, and Prisma validate pass

```
