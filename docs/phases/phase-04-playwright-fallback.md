# Phase 4: Playwright Fallback for Dynamic Pages

## Goal

Add browser-based scraping only as a fallback when Phase 2 HTTP scraping and generic parsing cannot extract rent data.

The purpose of this phase is to support dynamic apartment pages where rent data is rendered by JavaScript.

Phase 4 should reuse the existing pipeline:
- collector
- parser
- scrape service
- price snapshots
- alerts

Do not introduce direct JSON endpoint discovery yet. That is Phase 5.

## In Scope

- Install and configure Playwright
- Add a browser collector
- Use Playwright only as fallback after HTTP collection/parser returns no rent
- Capture rendered HTML/text
- Reuse the existing generic HTML rent parser
- Save RawPage metadata for browser-collected content
- Save ScrapeRun with crawler tier `BROWSER` when fallback is used
- Keep HTTP path as the default fast path
- Add tests with mocked browser collector behavior
- Add README notes for installing/running Playwright locally

## Out of Scope

Do not implement:
- direct JSON endpoint discovery
- network response endpoint persistence
- domain-specific parsers
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

Add:

collectors/
- browserCollector.ts

The browser collector should expose a small interface that can be mocked in tests.

Suggested type:

```ts
export type BrowserCollectedPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  contentHash: string;
  rendered: true;
};
````

The scrape service should support:

1. Run HTTP collection first.
2. Run generic parser on HTTP content.
3. If parsed rent items are found:

   * continue existing snapshot/alert flow
   * do not use Playwright
4. If no parsed rent items are found:

   * run browser collector fallback
   * run generic parser on rendered HTML/text
   * if parsed rent items are found, create snapshots/alerts
   * if no parsed rent items are found, create `NEEDS_REVIEW` alert as before

## Browser Collector Rules

The browser collector should:

* open the source URL
* wait for DOM content loaded or network idle with a reasonable timeout
* extract rendered page content
* compute content hash
* block unnecessary resources when practical:

  * images
  * fonts
  * media
  * ads/analytics if easy
* use conservative timeouts
* close browser/page/context safely
* surface errors to scrape service without uncaught route exceptions

Do not add stealth plugins or anti-detection behavior.
Do not add proxy rotation.
Do not bypass paywalls, logins, or access controls.

## Configuration

Add environment/config options if needed:

* `ENABLE_BROWSER_FALLBACK`

  * default false or true for local MVP, but document the choice
* `BROWSER_TIMEOUT_MS`

  * default around 15000
* `BROWSER_MAX_CONCURRENCY`

  * document for future worker phase, even if not enforced yet

If adding config, keep it simple.

## ScrapeRun Behavior

When browser fallback is used:

* create or update a ScrapeRun with crawlerTier `BROWSER`, or otherwise clearly record that fallback was used
* preserve the HTTP scrape run if the current design creates one
* save browser RawPage content separately if practical
* create PriceSnapshot rows if rendered content parses successfully
* create `NEEDS_REVIEW` if rendered content still has no rent
* create `SCRAPE_FAILED` if browser collector fails

## Testing

Do not use real external websites in tests.

Do not launch a real browser in unit/API tests unless already configured safely.

Prefer injecting/mocking the browser collector.

Add tests for:

1. HTTP parser success does not call browser fallback.
2. HTTP no-rent result calls browser fallback.
3. Browser fallback with rent creates PriceSnapshot.
4. Browser fallback with no rent creates `NEEDS_REVIEW` and no fake snapshot.
5. Browser failure creates `SCRAPE_FAILED`.
6. Existing Phase 1, Phase 2, and Phase 3 tests still pass.

## Constraints

* Do not implement direct JSON endpoint discovery.
* Do not add AI dependencies.
* Do not add embeddings or pgvector.
* Do not implement maps or Google Places.
* Do not implement review/social/forum crawling.
* Do not implement scoring or recommendations.
* Do not add authentication.
* Do not add frontend.
* Keep changes reviewable.
* Do not make broad refactors.

## Acceptance Criteria

Phase 4 is complete when:

* HTTP scraping remains the default path
* browser scraping is only used as fallback
* fallback can parse rendered HTML into PriceSnapshot rows
* failure paths create useful ScrapeRun and Alert records
* tests mock browser behavior and do not hit external websites
* all previous tests still pass
* lint, format, tests, Prisma generate, and Prisma validate pass

```
