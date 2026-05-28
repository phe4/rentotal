# Platform Profile Validation

Platform profiles must be validated with local sanitized fixtures before they are approved for automatic extraction. `DRAFT` is the default status for generated, guessed, or sample-derived profiles.

Safe workflow:

1. Add a sanitized fixture under `test/fixtures`.
2. Add the expected parsed output in `src/parsers/platformProfileValidationCases.ts`.
3. Create or update the profile as `DRAFT`.
4. Run `npm run profile:validate`.
5. Review any item count or field mismatch errors.
6. Human-review the fixture provenance, field mappings, false-positive risks, and validation output.
7. Mark the profile `APPROVED` only after validation passes and human approval is explicit.

Validation is deterministic and local-only. It does not call external websites, and it can explicitly validate `DRAFT` or `DISABLED` profiles without enabling them in production extraction.

Validation passing alone does not approve a profile. Production runtime should auto-use only `APPROVED` profiles that are backed by validated fixtures and human review.

## File-Based Profiles

Phase 6F adds local JSON profile loading from:

```text
platform-profiles/
  approved/
  generated/
```

`approved/` is for manually reviewed `APPROVED` profiles. `generated/` is for `DRAFT` or `DISABLED` profiles that can be explicitly validated but must not auto-run in production.

Profile files are JSON data only. Do not load arbitrary paths, remote URLs, cookies, tokens, secrets, or executable code.

## Draft Generation

Phase 6G can generate local DRAFT profile files from JSON or JSONP sample data:

```bash
npm run profile:generate-draft -- --platform "Example" --profile-id "example-units" --sample test/fixtures/example/units.json --url "https://example.com/api/units"
```

Generated profiles are written to `platform-profiles/generated` and always use `status: "DRAFT"`. The `--url` value is only a matching hint; it is not fetched.

Review generated mappings before adding validation cases. A generated profile must remain DRAFT until fixture validation and human review are complete.

## Local Approval Workflow

Phase 6H can copy a reviewed generated DRAFT profile into the approved profile directory:

```bash
npm run profile:approve -- --profile-id example-units --confirm
```

Approval requires the profile to exist in `platform-profiles/generated`, use `status: "DRAFT"`, have validation cases, pass validation, and include explicit `--confirm`.

The approval command writes an `APPROVED` copy under `platform-profiles/approved` and preserves the generated draft by default. It uses local files and fixtures only; it does not fetch remote URLs or execute profile content.
