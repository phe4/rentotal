# Phase 6F: File-Based Platform Profile Loading

## Goal

Add safe file-based loading for PlatformProfile definitions.

Phase 6C introduced code-based Platform Profiles. Phase 6D added deterministic validation tooling. Phase 6E added an Entrata Draft Profile.

Phase 6F should allow profiles to live in local JSON files so future generated profiles can be saved as DRAFT files before validation and approval.

## In Scope

- local file-based PlatformProfile loading
- profile JSON schema/type validation
- safe profile directories
- support for approved profiles
- support for generated draft profiles
- explicit validation of file-based DRAFT/DISABLED profiles
- production runtime auto-loads only APPROVED file profiles
- DRAFT/DISABLED file profiles do not production auto-run
- preserve existing code-based profiles
- tests with local files only
- documentation for file-based profile layout

## Out of Scope

Do not implement:

- profile draft generation
- AI-generated profile drafts
- admin approval UI
- DB-backed profiles
- Yardi profile
- new production profile approval command
- real external website tests
- new scraping behavior
- new Playwright behavior
- Google Places/maps
- reviews/social crawling
- scoring/recommendations
- frontend/auth
- pgvector/embeddings
- stealth/proxy/CAPTCHA bypass

## Directory Layout

Use local directories:

```text
platform-profiles/
  approved/
    cmssitemanager.approved.json
  generated/
    entrata-availability-floorplans.draft.json
```

Rules:

- `approved/` contains manually reviewed APPROVED profiles.
- `generated/` contains DRAFT or DISABLED profiles.
- File names should be descriptive.
- JSON files only.
- Do not load files from arbitrary paths.
- Do not follow path traversal outside `platform-profiles`.

## Loading Rules

Production runtime:

- load existing code-based profiles
- load file-based profiles from `platform-profiles/approved`
- only auto-run profiles with `status: "APPROVED"`
- ignore DRAFT/DISABLED profiles for production auto-match

Validation mode:

- can explicitly load profiles from `platform-profiles/approved`
- can explicitly load profiles from `platform-profiles/generated`
- can validate DRAFT/DISABLED profiles by profile id
- must not access external websites

## Profile Validation

Before a file-based profile can be used:

- validate required fields exist
- validate status is one of `DRAFT`, `APPROVED`, `DISABLED`
- validate platform/id/version exist
- validate mapping exists
- validate response format is supported
- validate rules object is sane
- validate endpointPromotion shape if present

Invalid profile files should produce clear errors and should not crash production runtime.

## Security Rules

Do not:

- load profiles outside `platform-profiles`
- follow path traversal
- execute JavaScript from profile files
- use eval or Function
- store or load cookies/tokens/secrets
- read arbitrary local files
- fetch remote profile URLs

Profiles are JSON data only.

## Code-Based Profiles

Keep existing code-based profiles.

Do not remove:

- CmsSiteManager profile
- Entrata draft profile
- custom Knock/Doorway parser
- custom CmsSiteManager parser

File-based loading is additive.

## Testing

Add tests for:

1. approved file-based profile loads and can auto-match.
2. DRAFT file-based profile does not production auto-match.
3. DRAFT file-based profile can be explicitly validated.
4. DISABLED file-based profile does not production auto-match.
5. invalid profile file returns clear validation error.
6. path traversal outside `platform-profiles` is rejected.
7. non-JSON files are ignored or rejected safely.
8. code-based profiles still work.
9. existing Phase 1–6E tests still pass.

Tests must use local temp fixtures/files only and must not hit real external websites.

## Acceptance Criteria

Phase 6F is complete when:

- file-based profile loader exists
- approved file profiles can be loaded
- generated draft profiles can be validated explicitly
- production runtime only auto-runs APPROVED profiles
- DRAFT/DISABLED profiles do not auto-run
- invalid profiles fail safely with clear errors
- path traversal is rejected
- code-based profiles remain supported
- all tests pass
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass

```

After making documentation changes:
- Run formatter if configured.
- Do not implement source code.
- Summarize changed files.
```
