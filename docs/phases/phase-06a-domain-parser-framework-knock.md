# Phase 6A: Domain Parser Framework and Knock/Doorway Support

## Goal

Add a domain-specific parser framework and the first platform-specific support for Knock / Doorway API.

Phase 6 is intentionally split into sub-phases:

- Phase 6A: Parser framework + Knock/Doorway support
- Phase 6B: Entrata support
- Phase 6C: Yardi support
- Phase 6D: Additional platform parsers as needed

This document covers Phase 6A only.

Do not implement Entrata, Yardi, Greystar, Avalon, Essex, or other platform parsers in Phase 6A.

## Why Knock First

Manual validation against Fairway Glen showed that the generic Phase 2–5 pipeline is stable but cannot create `PriceSnapshot` for a Knock-powered site yet.

Tested URL:

```text
https://www.fairwayglen.com/floor-plans?utm_knock=g
```

Observed Knock / Doorway endpoints:

```text
https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29
https://doorway-api.knockrentals.com/v1/property/2010930/units
```

The community endpoint should be treated as a candidate/discovery endpoint, not automatically promoted as the preferred direct JSON price endpoint.

The units endpoint is the likely price/availability source and should become the preferred direct JSON endpoint only when detection is confident.

## Current Pipeline Before Phase 6A

Existing generic pipeline:

```text
Direct JSON if preferredDirectJsonEndpoint exists
↓
HTTP scrape
↓
Generic HTML parser
↓
Playwright fallback if HTTP succeeds but no rent is parsed
↓
Network JSON candidate discovery
↓
Generic JSON parser
↓
PriceSnapshot / effective rent / alerts
```

Phase 6A should extend this pipeline with a parser registry and Knock-specific parser/detection while preserving generic fallbacks.

## In Scope

- Parser registry
- Parser priority order
- Parser name/version/confidence metadata
- Platform detection framework
- Knock / Doorway API detection
- Knock community endpoint interpretation if fixture data supports it
- Knock units endpoint support
- Conservative Knock units JSON parser
- Safe promotion of Knock units endpoint to `preferredDirectJsonEndpoint`
- Use mocked/local fixtures only
- Reuse existing `ParsedPriceItem` output shape
- Reuse existing snapshot/effective rent/alert pipeline
- Tests for parser selection, Knock units parsing, and endpoint promotion

## Out of Scope

Do not implement:

- Phase 6B Entrata parser
- Phase 6C Yardi parser
- Greystar parser
- Avalon parser
- Essex parser
- other platform parsers
- new Playwright behavior beyond existing network capture
- broad direct JSON discovery redesign
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
- stealth plugins, proxies, CAPTCHA bypass, or anti-detection logic
- real external website calls in tests

## Future Sub-Phases

### Phase 6B: Entrata Support

Future only. Do not implement now.

Expected future scope:

- Entrata platform detection
- Entrata fixture collection
- Entrata parser
- parser registry integration
- tests with mocked fixtures only

### Phase 6C: Yardi Support

Future only. Do not implement now.

Expected future scope:

- Yardi platform detection
- Yardi fixture collection
- Yardi parser
- parser registry integration
- tests with mocked fixtures only

### Phase 6D: Additional Platforms

Future only. Do not implement now.

Potential targets:

- Greystar
- AvalonBay
- Essex
- UDR
- Bozzuto
- Windsor
- EquityApartments

## Architecture

Add or extend:

parsers/

- parserRegistry.ts
- platformDetector.ts
- knockDoorwayParser.ts
- genericJsonRentParser.ts remains fallback
- genericHtmlRentParser.ts remains fallback

Suggested parser interface:

```ts
export type ParserContext = {
  url?: string;
  sourceUrl?: string;
  sourceType?: string;
  contentType?: string;
  metadata?: unknown;
};

export type ParserResult = {
  parserName: string;
  parserVersion: string;
  confidence: number;
  items: ParsedPriceItem[];
  metadata?: Record<string, unknown>;
};

export interface PriceParser {
  name: string;
  version: string;
  priority: number;
  canParse(input: {
    url?: string;
    text?: string;
    json?: unknown;
    context?: ParserContext;
  }): boolean;
  parse(input: {
    url?: string;
    text?: string;
    json?: unknown;
    context?: ParserContext;
  }): ParserResult;
}
```

If the existing parser interface is simpler, adapt carefully without broad refactors.

## Parser Priority

Use this order:

1. Knock / Doorway parser when URL or JSON clearly matches Knock/Doorway
2. Generic JSON parser
3. Generic HTML parser

Do not remove generic fallback.

## Knock / Doorway Detection

Detect Knock/Doorway when:

- URL host includes `doorway-api.knockrentals.com`
- URL path matches:
  - `/v1/property/community/{id}`
  - `/v1/property/{propertyId}/units`

- JSON contains strong Knock-like property/unit/floorplan fields, if fixture confirms them

Community endpoint:

- may identify property/community metadata
- should not become preferredDirectJsonEndpoint unless it contains parseable rent/unit data
- may help infer a units endpoint only if the property id is clearly present

Units endpoint:

- should be treated as the primary price/availability endpoint
- can become preferredDirectJsonEndpoint when confidence is high

## Knock Units Parser Rules

The Knock parser should parse mocked Knock units JSON into `ParsedPriceItem`.

It should conservatively extract:

- floorplanName
- unitNumber
- bedrooms
- bathrooms
- sqft
- baseRent
- effectiveRent only if explicitly present, otherwise leave to existing effective rent utility
- leaseTermMonths if present
- moveInDate if present
- specialOfferText if present
- specialOfferValue if present and numeric
- availabilityStatus
- rawData

Rules:

- Only create `ParsedPriceItem` when a rent-like numeric value exists.
- Do not hallucinate rent from unrelated numbers.
- Do not create snapshots from community-only JSON unless it contains clear unit/rent data.
- Preserve raw matched unit object in `rawData`.
- Return confidence based on endpoint type and parsed fields.

## Endpoint Promotion Rules

A candidate can become `preferredDirectJsonEndpoint` only if:

- it is a Knock units endpoint, or
- it returns parseable rent/unit data with high confidence

Do not promote:

- community endpoint only
- analytics/tracking/config endpoints
- endpoints without rent/unit data
- low-confidence candidates

When a Knock units endpoint is discovered or inferred safely:

- store it in `PropertySource.metadata.preferredDirectJsonEndpoint`
- preserve existing metadata
- do not store sensitive headers/cookies/tokens

## Fixture Policy

Use local mocked fixtures only.

Suggested files:

- test/fixtures/knock/community.json
- test/fixtures/knock/units.json
- test/fixtures/knock/no-rent-units.json

Fixtures should be sanitized and minimal.

Do not include personal data, cookies, tokens, real resident information, or sensitive values.

## Testing

Add tests for:

1. parser registry chooses Knock parser before generic JSON for Knock units URL.
2. Knock parser parses units JSON into `ParsedPriceItem`.
3. Knock parser does not parse community-only JSON as rent snapshots.
4. Knock units endpoint can become `preferredDirectJsonEndpoint` when confidence is high.
5. Knock community endpoint is stored as candidate but not preferred.
6. Low-confidence Knock-like data does not create snapshots.
7. Generic JSON parser remains fallback for non-Knock JSON.
8. Existing Phase 1–5 tests still pass.

Tests must not hit real external websites.

## Constraints

- Keep changes reviewable.
- Do not make broad refactors.
- Do not add dependencies unless absolutely necessary.
- Do not change existing public API behavior unless required for parser registry integration.
- Do not add real network calls in tests.
- Do not implement Phase 6B/6C/6D.
- Do not implement other domain parsers.

## Acceptance Criteria

Phase 6A is complete when:

- parser registry exists
- platform/domain detection exists
- parser priority is deterministic
- Knock/Doorway parser handles mocked units JSON
- community endpoint is not promoted as preferred price endpoint
- units endpoint can be promoted safely when confidence is high
- parsed Knock units create `ParsedPriceItem` and feed existing snapshot pipeline
- generic parser fallback remains intact
- Entrata/Yardi are documented as future sub-phases but not implemented
- all tests pass
- lint, format, tests, Prisma generate, and Prisma validate pass

```

```
