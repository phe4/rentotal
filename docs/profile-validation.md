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
