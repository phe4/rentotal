# Phase 6H: Platform Profile Approval Workflow

## Goal

Add a safe local CLI workflow for approving generated PlatformProfile DRAFT files.

Phase 6G can generate DRAFT profiles from local sample data. Phase 6D can validate profiles against local fixtures. Phase 6H should connect those pieces by allowing a reviewed DRAFT profile to be promoted to APPROVED only after validation passes and the user explicitly confirms approval.

This phase should not add a UI or DB-backed profiles.

## Product Direction

The long-term profile workflow is:

```text
sample data
->
generate DRAFT profile
->
run validation
->
human review
->
approve profile
->
production runtime can auto-use profile
```

Phase 6H covers only:

```text
validated DRAFT profile + explicit approval -> APPROVED file profile
```

## In Scope

- local approval utility
- local approval CLI script
- explicit `--confirm` requirement
- validation-before-approval check
- generated DRAFT profile approval
- copy or move approved profile into `platform-profiles/approved`
- update profile status from DRAFT to APPROVED
- preserve original generated draft unless explicitly choosing move behavior
- safe file path handling
- tests with local temp files only
- documentation for approval workflow

## Out of Scope

Do not implement:

- web admin UI
- DB-backed profiles
- AI-generated profile drafts
- automatic approval
- approval without validation
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

## Approval Rules

A profile can be approved only when:

1. It is loaded from `platform-profiles/generated`.
2. It has `status: "DRAFT"`.
3. It passes profile validation.
4. The approval command includes an explicit confirmation flag, for example `--confirm`.
5. The approved output is written under `platform-profiles/approved`.
6. The approved file has `status: "APPROVED"`.

A profile must not be approved when:

- it is already APPROVED
- it is DISABLED
- it fails validation
- it is outside `platform-profiles/generated`
- path traversal is attempted
- no explicit confirmation flag is provided
- expected validation case is missing

## Output Behavior

Prefer copy behavior:

```text
platform-profiles/generated/example.draft.json
-> copy with status changed
platform-profiles/approved/example.approved.json
```

Do not delete the original draft by default.

The approved file name should be deterministic.

Example:

```text
example-units.draft.json
->
example-units.approved.json
```

## CLI

Add a local script if appropriate:

```bash
npm run profile:approve -- --profile-id example-units --confirm
```

The exact CLI shape can be adapted to the existing project.

The CLI should:

- read from `platform-profiles/generated`
- require `--confirm`
- validate the profile before approval
- write to `platform-profiles/approved`
- print clear success/failure output
- not fetch remote URLs
- not execute profile content

## Validation Requirement

Approval must require validation.

If the existing validation cases are keyed by profile id, use them.

If no validation case exists for the profile id:

- fail approval with a clear message

If validation fails:

- fail approval with validation errors

Validation passing alone does not approve a profile. The explicit approval command is required.

## Security Rules

Do not:

- load profiles outside `platform-profiles/generated`
- write outside `platform-profiles/approved`
- follow path traversal
- fetch remote URLs
- execute JavaScript
- use eval or Function
- approve DISABLED profiles
- approve profiles without validation cases

## Testing

Add tests for:

1. approving a DRAFT profile with passing validation and `--confirm` writes APPROVED file.
2. approval preserves original draft file.
3. approved output path is under `platform-profiles/approved`.
4. approval fails without `--confirm`.
5. approval fails if profile status is DISABLED.
6. approval fails if profile is already APPROVED.
7. approval fails if validation case is missing.
8. approval fails if validation fails.
9. path traversal is rejected.
10. approved profile can production auto-run after loading from `approved`.
11. existing Phase 1-6G tests still pass.

Tests must use local temp files only and must not hit real external websites.

## Acceptance Criteria

Phase 6H is complete when:

- approval utility exists
- approval CLI exists
- approval requires `--confirm`
- approval requires validation pass
- DRAFT profile can be copied to approved with status APPROVED
- original DRAFT is preserved by default
- DISABLED/APPROVED/invalid profiles cannot be approved
- missing validation cases block approval
- path traversal is rejected
- no remote URLs are fetched
- approved file profiles can production auto-run
- docs explain approval workflow
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
