# Platform Profile Validation

Platform profiles must be validated with local sanitized fixtures before they are approved for automatic extraction.

Safe workflow:

1. Add a sanitized fixture under `test/fixtures`.
2. Add the expected parsed output in `src/parsers/platformProfileValidationCases.ts`.
3. Create or update the profile as `DRAFT`.
4. Run `npm run profile:validate`.
5. Review any item count or field mismatch errors.
6. Mark the profile `APPROVED` only after validation passes.

Validation is deterministic and local-only. It does not call external websites, and it can explicitly validate `DRAFT` or `DISABLED` profiles without enabling them in production extraction.
