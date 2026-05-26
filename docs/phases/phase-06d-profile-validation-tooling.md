# Phase 6D: Platform Profile Validation Tooling

## Goal

Add deterministic validation tooling for platform profiles.

Phase 6C introduced the Platform Profile Framework. Phase 6D should make it easier and safer to add future profiles such as Entrata and Yardi by validating profiles against local fixtures and expected parsed output.

This phase should not add production Entrata/Yardi profiles yet.

## Why This Phase Exists

Platform profiles should not be enabled just because a mapping looks plausible.

Rent extraction has high false-positive risk. Examples of values that must not become rent:

- phone numbers
- property ids
- site ids
- square feet
- lease terms
- deposits
- application fees
- parking fees
- tracking ids

Therefore, each profile should have a deterministic fixture validation workflow before it is approved.

## In Scope

- profile validation utility
- profile fixture runner
- expected output comparison
- validation report type
- validation error/warning messages
- support for validating APPROVED, DRAFT, and DISABLED profiles in explicit validation mode
- script or test helper to run profile validation against local fixtures
- documentation for adding a new profile safely
- example validation for existing CmsSiteManager profile
- local fixtures only

## Out of Scope

Do not implement:

- AI-generated profile drafts
- DB-backed profiles
- profile approval UI
- web admin tooling
- Entrata production profile
- Yardi production profile
- real external website tests
- new scraping behavior
- new Playwright behavior
- Google Places/maps
- reviews/social crawling
- scoring/recommendations
- frontend/auth
- pgvector/embeddings
- stealth/proxy/CAPTCHA bypass

## Validation Concept

A profile validation case should contain:

```ts
{
  name: "CmsSiteManager Proxy/GetUnits basic units",
  profileId: "cmssitemanager-proxy-getunits",
  input: {
    url: "https://example.com/CmsSiteManager/callback.aspx?act=Proxy/GetUnits&siteid=1206682",
    contentType: "application/javascript",
    fixturePath: "test/fixtures/cmssitemanager/units.jsonp"
  },
  expectedItems: [
    {
      floorplanName: "A1",
      unitNumber: "153",
      bedrooms: 1,
      bathrooms: 1,
      sqft: 710,
      baseRent: 2719,
      mandatoryFees: 5,
      leaseTermMonths: 13,
      availabilityStatus: "AVAILABLE"
    }
  ]
}
```

The validator should:

1. load fixture
2. load profile
3. run profile runtime in explicit validation mode
4. compare parsed items to expected items
5. return pass/fail with useful diffs

## Validation Report

Create a deterministic validation report shape, for example:

```ts
type ProfileValidationReport = {
  passed: boolean;
  profileId: string;
  caseName: string;
  itemCount: number;
  expectedCount: number;
  errors: string[];
  warnings: string[];
};
```

## Comparison Rules

The comparison should be strict enough to catch mapping mistakes, but not overcomplicated.

For Phase 6D:

- compare item count
- compare selected fields in expectedItems
- ignore extra fields unless explicitly requested
- compare numbers exactly after normalization
- compare strings exactly after trimming
- include clear error messages for mismatches

## Explicit Validation Mode

In normal runtime:

- only APPROVED profiles auto-run

In validation mode:

- validator can run DRAFT or DISABLED profiles explicitly by profile id
- this allows testing profile drafts without enabling them in production extraction

## CLI or Script

Add one simple way to run profile validation.

Options:

- npm script, for example `npm run profile:validate`
- or a test helper if project scripts are not suitable

Prefer a simple npm script if it fits the existing project.

The script should use local fixtures only and must not hit external websites.

## Documentation

Update README or docs with:

How to add a profile safely:

1. add sanitized fixture
2. add expected output
3. create DRAFT profile
4. run validation
5. review mapping
6. mark APPROVED only after validation passes

## Testing

Add tests for:

1. validator passes for CmsSiteManager fixture and expected output.
2. validator fails when expected item count differs.
3. validator fails with clear field mismatch error.
4. validator can run a DRAFT profile explicitly.
5. validator can run a DISABLED profile explicitly.
6. normal runtime still only auto-runs APPROVED profiles.
7. validation uses local fixtures only.
8. existing Phase 1–6C tests still pass.

## Acceptance Criteria

Phase 6D is complete when:

- profile validation utility exists
- validation report type exists
- CmsSiteManager profile has at least one validation case
- validation catches item count mismatch
- validation catches field mismatch
- validation can explicitly validate DRAFT/DISABLED profiles
- production runtime still only auto-runs APPROVED profiles
- validation uses local fixtures only
- docs explain how to add a profile safely
- all tests pass
- lint, format, tests, Prisma generate, and Prisma validate pass

```

After making documentation changes:
- Run formatter if configured.
- Do not implement source code.
- Summarize changed files.
```
