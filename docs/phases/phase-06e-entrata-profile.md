# Phase 6E: Entrata Platform Profile

## Goal

Add Entrata support using the Platform Profile framework and validation tooling.

This phase should validate the profile-first approach for a new platform. It should not add a hard-coded Entrata parser unless the profile framework is clearly insufficient.

Because the current fixtures are local mocked/synthetic samples, the Entrata profile must remain `DRAFT`. It can be validated explicitly, but it must not auto-run in production runtime until it is based on real sanitized Entrata sample data, validation passes, and a human explicitly approves it.

## In Scope

- Entrata PlatformProfile
- Entrata profile matcher
- local sanitized Entrata fixtures
- Entrata validation cases
- expected ParsedPriceItem output
- profile validation through existing tooling
- production runtime can auto-run the profile only if status is APPROVED
- tests with local fixtures/mocks only
- reuse existing ParsedPriceItem shape
- reuse existing snapshot/effective rent/alert/dedup pipeline

## Out of Scope

Do not implement:

- Yardi profile
- Greystar profile
- Avalon profile
- Essex profile
- hard-coded Entrata parser unless explicitly justified
- DB-backed profiles
- profile approval UI
- AI-generated profile drafts
- real external website tests
- new scraping behavior
- new Playwright behavior
- Google Places/maps
- reviews/social crawling
- scoring/recommendations
- frontend/auth
- pgvector/embeddings
- stealth/proxy/CAPTCHA bypass

## Entrata Profile Approach

Entrata should be represented as a PlatformProfile when fixture structure is stable enough.

Default status should be `DRAFT` unless the profile is backed by real sanitized sample data and human review.

The profile should describe:

- platform name: Entrata
- version
- status
- URL or content matching rules
- response format
- array path
- field mapping
- required fields
- numeric fields
- baseRent sanity range
- rawData preserve fields
- endpoint promotion rules if applicable

## Matching Rules

Entrata detection should be conservative.

Possible signals:

- URL host/path contains `entrata`
- response contains Entrata-specific platform markers
- JSON contains Entrata-like floorplan/unit structure
- endpoint/query/path includes availability/floorplan/apartment signals and Entrata markers

Do not match generic apartment JSON without strong Entrata signals.

## Mapping Requirements

Entrata profile should map available fixture fields into ParsedPriceItem:

- floorplanName
- unitNumber
- bedrooms
- bathrooms
- sqft
- baseRent
- effectiveRent only if explicitly present
- leaseTermMonths
- moveInDate
- specialOfferText
- specialOfferValue
- mandatoryFees
- availabilityStatus
- rawData preserve fields

Rules:

- Only create items when clear rent-like numeric data exists.
- If fixture only has floorplan-level min/max rent, use min rent as baseRent and preserve max rent in rawData.
- Do not hallucinate rent from IDs, sqft, phone numbers, lease terms, deposits, or fee-only fields.
- Keep profile status as DRAFT until validation passes against real sanitized sample data and a human reviews the mapping.
- Mark APPROVED only after validation cases pass and human approval is explicit.
- Validation passing alone does not approve a profile.

## Fixtures

Use local sanitized fixtures only.

Suggested files:

- test/fixtures/entrata/availability.json
- test/fixtures/entrata/floorplans.json
- test/fixtures/entrata/no-rent.json

Fixtures must be minimal and sanitized.

Do not include:

- personal data
- resident data
- cookies
- tokens
- auth headers
- real user information
- sensitive values

## Validation Cases

Add validation cases for:

1. Entrata unit-level availability fixture maps to ParsedPriceItem.
2. Entrata floorplan-level min/max rent fixture maps min rent to baseRent and preserves max rent in rawData.
3. Entrata no-rent fixture produces no items.
4. Entrata profile does not match unrelated JSON.
5. Entrata profile remains DRAFT unless it is backed by real sanitized sample data, validation passes, and human approval is explicit.
6. Existing CmsSiteManager profile validation still passes.

## Testing

Add tests for:

1. Entrata profile matcher matches strong Entrata fixture.
2. Entrata profile matcher rejects unrelated JSON.
3. Entrata profile maps unit-level data into ParsedPriceItem.
4. Entrata profile maps floorplan-level rent range conservatively.
5. Entrata no-rent fixture creates no parsed items.
6. `npm run profile:validate` includes Entrata validation cases.
7. Existing Knock/Doorway custom parser behavior still passes.
8. Existing CmsSiteManager custom parser/profile behavior still passes.
9. Existing Phase 1–6D tests still pass.

Tests must use local fixtures/mocks only.

## Acceptance Criteria

Phase 6E is complete when:

- Entrata PlatformProfile exists
- Entrata sanitized fixtures exist
- Entrata validation cases exist
- profile validation passes for Entrata fixtures
- Entrata profile uses the existing Platform Profile runtime
- Entrata profile remains DRAFT unless real sanitized sample data and explicit human approval exist
- DRAFT Entrata profile can be validated explicitly
- DRAFT Entrata profile does not auto-run in production runtime
- Entrata is not implemented as a hard-coded parser unless explicitly justified
- Entrata profile does not match unrelated JSON
- existing Knock/Doorway behavior remains intact
- existing CmsSiteManager behavior remains intact
- existing profile validation tooling remains intact
- all tests pass
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
  After making documentation changes:

Run formatter if configured.
Do not implement source code.
Summarize changed files.
