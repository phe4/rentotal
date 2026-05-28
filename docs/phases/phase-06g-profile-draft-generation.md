# Phase 6G: Profile Draft Generation From Sample Data

## Goal

Add deterministic local tooling to generate PlatformProfile DRAFT files from sample JSON or JSONP data.

This phase should make it easier to onboard a new platform by generating a draft mapping file that a developer/admin can review, validate, and later approve.

Generated profiles must never be automatically approved.

## Product Direction

The long-term profile workflow is:

```text
sample data
↓
generate DRAFT profile
↓
run profile validation
↓
human review
↓
mark APPROVED
↓
production runtime can auto-use profile
```

Phase 6G covers only:

```text
sample data → generated DRAFT profile file
```

It does not cover approval.

## In Scope

- deterministic profile draft generator
- local sample JSON support
- local sample JSONP support through existing JSONP utility
- array path detection
- candidate row detection
- field mapping suggestion
- required field suggestion
- numeric field suggestion
- baseRent sanity defaults
- rawData preserve suggestion
- profile id/platform name input
- file output to `platform-profiles/generated/*.draft.json`
- safe local file path handling
- tests with local fixtures only
- documentation for generated draft review

## Out of Scope

Do not implement:

- AI-generated drafts
- LLM calls
- DB-backed profile drafts
- admin approval UI
- automatic approval
- automatic production enablement
- Yardi profile
- real external website tests
- new scraping behavior
- new Playwright behavior
- Google Places/maps
- reviews/social crawling
- scoring/recommendations
- frontend/auth
- pgvector/embeddings
- stealth/proxy/CAPTCHA bypass

## Draft Status Rule

Every generated profile must have:

```json
"status": "DRAFT"
```

The generator must not create `APPROVED` profiles.

The production runtime must not auto-run generated DRAFT profiles.

## Input

A draft generation request should include:

```ts
{
  platform: string;
  profileId: string;
  samplePath: string;
  sampleUrl?: string;
  responseFormat?: "json" | "jsonp";
}
```

Rules:

- samplePath must be local.
- samplePath must be under an allowed sample/fixture directory.
- no remote URLs should be fetched.
- sampleUrl is metadata/matching hint only, not fetched.
- JSONP must be parsed without eval or Function.

## Output

Write generated profile JSON to:

```text
platform-profiles/generated/<profileId>.draft.json
```

The file should include:

- id
- platform
- version
- status: DRAFT
- match hints from sampleUrl if provided
- response format
- inferred arrayPath
- inferred mapping
- requiredFields
- numericFields
- minBaseRent
- maxBaseRent
- rawData preserve fields if detected
- endpointPromotion default disabled unless strong URL hints exist

## Array Path Detection

Detect likely array paths by scanning objects recursively.

Candidate arrays should be scored higher when rows contain rent/unit/floorplan-like fields.

Signals:

- rent
- price
- marketRent
- minRent
- maxRent
- unit
- unitNumber
- floorplan
- floorPlanName
- beds
- bedrooms
- baths
- bathrooms
- sqft
- squareFeet
- available
- availability
- moveInDate
- special
- concession

The selected arrayPath should be the highest-confidence candidate.

If no confident arrayPath is found, generation should fail with a clear error.

## Field Mapping Suggestion

Suggest mappings into ParsedPriceItem fields:

- floorplanName
- unitNumber
- bedrooms
- bathrooms
- sqft
- baseRent
- leaseTermMonths
- moveInDate
- mandatoryFees
- availabilityStatus
- specialOfferText
- specialOfferValue

Base rent candidates:

- rent
- price
- marketRent
- minRent
- minimumRent
- effectiveRent only if clearly marked

Do not suggest baseRent from:

- totalRent by default
- id
- propertyId
- siteId
- phone
- sqft
- squareFeet
- leaseTerm
- deposit
- fee
- applicationFee
- parkingFee
- tracking ids

## Numeric Normalization

Generated profiles should mark clear numeric fields:

- baseRent
- bedrooms
- bathrooms
- sqft
- mandatoryFees
- specialOfferValue
- leaseTermMonths

Default baseRent sanity:

- minBaseRent: 300
- maxBaseRent: 20000

## Raw Data Preserve Suggestion

Suggest preserving fields such as:

- totalRent
- maxRent
- minRent
- partnerName
- partnerPropertyId
- floorplanId
- unitId

Do not preserve sensitive fields:

- token
- auth
- cookie
- session
- password
- secret
- resident
- user

## Endpoint Promotion

Default:

- canPromote: false

The generator may suggest canPromote true only when:

- sampleUrl is provided
- sampleUrl looks like a unit/availability/floorplan endpoint
- arrayPath and baseRent mapping are confident

Even then, profile status remains DRAFT.

## CLI or Script

Add a local script if appropriate:

```bash
npm run profile:generate-draft -- --platform "Example" --profile-id "example-units" --sample test/fixtures/example/units.json --url "https://example.com/api/units"
```

The exact CLI shape can be adapted to the existing project.

The script must:

- read local sample only
- generate DRAFT profile only
- write to platform-profiles/generated
- not fetch remote URLs
- print clear success/failure output

## Testing

Add tests for:

1. generator creates DRAFT profile from JSON fixture.
2. generator creates DRAFT profile from JSONP fixture.
3. generated profile is written under `platform-profiles/generated`.
4. generated profile never has APPROVED status.
5. generator rejects sample paths outside allowed directories.
6. generator does not fetch sampleUrl.
7. arrayPath detection picks a units-like array.
8. field mapping suggests baseRent from rent/minRent but not totalRent/id/sqft/fee/deposit.
9. generated draft profile can be explicitly validated after expected output is added.
10. production runtime does not auto-run generated DRAFT profile.
11. existing Phase 1–6F tests still pass.

## Acceptance Criteria

Phase 6G is complete when:

- deterministic draft generator exists
- JSON and JSONP samples are supported
- arrayPath detection works for units-like arrays
- field mapping suggestion avoids unsafe rent fields
- generated profiles are always DRAFT
- generated profiles are written only to platform-profiles/generated
- no external URLs are fetched
- generated DRAFT profiles do not production auto-run
- tests cover safe generation and unsafe cases
- docs explain review/validation/approval steps
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass

```

After making documentation changes:
- Run formatter if configured.
- Do not implement source code.
- Summarize changed files.
```
