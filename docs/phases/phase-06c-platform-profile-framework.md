# Phase 6C: Platform Profile Framework

## Goal

Add a deterministic Platform Profile framework for mapping-based platform extraction.

The goal is to avoid writing a new hard-coded TypeScript parser for every platform when the platform response structure is stable and can be described with configuration.

The extraction strategy becomes:

```text
Custom Parser
↓
Platform Profile Parser
↓
Generic Fallback
```

## Why This Phase Exists

Phase 6A added parser registry and Knock/Doorway support. Knock is a good fit for a custom parser because it may require endpoint discovery, property id inference, and special `/units` promotion logic.

Phase 6B added CmsSiteManager JSONP and HTML price range support. CmsSiteManager showed that many platforms can be represented as a deterministic mapping:

- match URL/query
- unwrap JSONP
- find array path
- map fields
- normalize values
- validate required fields
- output ParsedPriceItem

This pattern should be generalized into Platform Profiles.

## In Scope

- PlatformProfile type
- profile matcher
- profile registry
- profile parser runtime
- deterministic mapping from profile to ParsedPriceItem
- JSON support
- JSONP support
- arrayPath support
- nested path support
- field mapping support
- fallback field mapping support
- numeric normalization
- required field validation
- baseRent min/max sanity checks
- rawData preserve rules
- endpoint promotion rule representation
- CmsSiteManager profile as first example profile
- fixture-based validation tests
- existing custom parsers remain intact
- existing Knock/Doorway behavior remains intact
- existing CmsSiteManager behavior remains intact

## Out of Scope

Do not implement:

- DB-backed profiles
- UI for profile approval
- AI-generated profile drafts
- profile approval workflow
- Entrata production profile
- Yardi production profile
- replacing existing custom parsers
- removing Knock custom parser
- removing CmsSiteManager parser
- real external website tests
- new Playwright behavior
- Google Places/maps
- reviews/social crawling
- scoring/recommendations
- frontend/auth
- stealth/proxy/CAPTCHA bypass
- AI extraction
- embeddings
- pgvector

## Platform Profile Concept

A Platform Profile describes how to convert a known platform response into ParsedPriceItem.

Example:

```json
{
  "platform": "CmsSiteManager",
  "version": "1.0.0",
  "status": "APPROVED",
  "match": {
    "urlIncludes": ["/CmsSiteManager/callback.aspx"],
    "query": {
      "act": "Proxy/GetUnits"
    }
  },
  "response": {
    "format": "jsonp",
    "arrayPath": "units"
  },
  "mapping": {
    "floorplanName": "floorplanName",
    "unitNumber": ["unitNumber", "name"],
    "bedrooms": "numberOfBeds",
    "bathrooms": "numberOfBaths",
    "sqft": "squareFeet",
    "baseRent": "rent",
    "leaseTermMonths": "minLeaseTermInMonth",
    "moveInDate": "internalAvailableDate",
    "mandatoryFees": "mandatoryFeesDeposits",
    "availabilityStatus": ["unitLeasedStatus", "leaseStatus"]
  },
  "rawData": {
    "preserve": ["totalRent", "partnerName", "partnerPropertyId"]
  },
  "rules": {
    "requiredFields": ["baseRent"],
    "numericFields": [
      "baseRent",
      "bedrooms",
      "bathrooms",
      "sqft",
      "mandatoryFees"
    ],
    "minBaseRent": 300,
    "maxBaseRent": 20000,
    "doNotUseAsBaseRent": ["totalRent"]
  },
  "endpointPromotion": {
    "canPromote": true,
    "stripQueryParams": ["callback", "_"],
    "requiredParseableItems": 1
  }
}
```

## Profile Runtime Rules

The profile parser runtime must be deterministic.

Same input + same profile must produce same output.

Runtime flow:

```text
input: url + contentType + text/json
↓
match approved profile
↓
parse response format json/jsonp
↓
locate arrayPath
↓
apply mapping to each row
↓
normalize number/date/text
↓
validate required fields
↓
validate baseRent range
↓
preserve selected rawData fields
↓
output ParsedPriceItem[]
```

## Profile Status

For Phase 6C, profiles can live in code.

Support status values:

```text
DRAFT
APPROVED
DISABLED
```

Only APPROVED profiles should be used automatically by the runtime.

DRAFT profiles can exist for tests or future tooling, but should not run in production extraction unless explicitly requested by a test.

## Field Mapping Rules

Support:

### Single path

```json
"baseRent": "rent"
```

### Fallback paths

```json
"unitNumber": ["unitNumber", "name"]
```

### Nested paths

```json
"baseRent": "pricing.marketRent"
```

### Optional fields

Missing optional fields should not fail the row.

### Required fields

Missing required fields should skip the row.

## Numeric Normalization Rules

Normalize numeric strings:

```text
"2719" → 2719
"2,719" → 2719
"$2,719" → 2719
"5.00" → 5
```

Reject:

- phone numbers
- IDs
- lease terms as rent
- square feet as rent
- fee/deposit fields as baseRent unless explicitly mapped to mandatoryFees
- baseRent below minBaseRent
- baseRent above maxBaseRent

## Raw Data Rules

The profile can preserve selected raw fields.

Example:

```json
"rawData": {
  "preserve": ["totalRent", "partnerName", "partnerPropertyId"]
}
```

Do not preserve sensitive values:

- cookies
- auth tokens
- API keys
- session ids
- resident/user data

## Endpoint Promotion Rules

Profile can describe endpoint promotion behavior, but Phase 6C does not need to redesign the whole promotion pipeline.

Support the profile shape and basic utility behavior.

For CmsSiteManager:

- canPromote = true
- strip callback and cachebuster params
- require at least 1 parseable item

Do not overwrite a higher-priority working custom parser endpoint such as Knock `/units` unless there is a clear explicit reason.

## CmsSiteManager Example Profile

Add a code-based CmsSiteManager profile as the first example.

It should match:

- `/CmsSiteManager/callback.aspx`
- query param `act=Proxy/GetUnits`
- JSONP response with `units`

It should map:

- floorplanName = floorplanName
- unitNumber = unitNumber or name
- bedrooms = numberOfBeds
- bathrooms = numberOfBaths
- sqft = squareFeet
- baseRent = rent
- leaseTermMonths = minLeaseTermInMonth
- moveInDate = internalAvailableDate
- mandatoryFees = mandatoryFeesDeposits
- availabilityStatus = unitLeasedStatus or leaseStatus

It should preserve:

- totalRent
- partnerName
- partnerPropertyId

It must not use totalRent as baseRent.

## Testing

Add tests for:

1. profile matcher matches CmsSiteManager URL/query.
2. profile matcher does not match unrelated URLs.
3. JSONP input is unwrapped safely through existing JSONP utility.
4. profile parser maps CmsSiteManager units into ParsedPriceItem.
5. fallback fields work, e.g. unitNumber then name.
6. nested path mapping works.
7. numeric normalization works for dollars, commas, and decimals.
8. required field validation skips rows without baseRent.
9. min/max baseRent sanity checks reject bad values.
10. rawData preserve keeps totalRent but does not use it as baseRent.
11. DRAFT profiles do not run automatically.
12. DISABLED profiles do not run automatically.
13. APPROVED profile runs automatically.
14. existing Knock custom parser behavior remains intact.
15. existing CmsSiteManager custom parser behavior remains intact.
16. existing Phase 1–6B tests still pass.

Tests must use local fixtures/mocks only.

## Acceptance Criteria

Phase 6C is complete when:

- PlatformProfile type exists
- profile registry exists
- profile matcher exists
- profile parser runtime exists
- CmsSiteManager profile exists as first example
- runtime can parse CmsSiteManager fixture into ParsedPriceItem
- only APPROVED profiles run automatically
- DRAFT/DISABLED profiles do not run automatically
- existing custom parsers are not replaced
- existing Knock/Doorway behavior remains intact
- existing CmsSiteManager behavior remains intact
- all tests pass
- lint, format, tests, Prisma generate, and Prisma validate pass

```

After making documentation changes:
- Run formatter if configured.
- Do not implement source code.
- Summarize changed files.
```
