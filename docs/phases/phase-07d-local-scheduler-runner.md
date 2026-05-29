# Phase 7D: Local Scheduler / Cron-Friendly Price Check Runner

## Goal

Add a local one-shot CLI runner for price checks.

The runner should allow the existing price-check run-all workflow to be triggered safely from:

- Windows Task Scheduler
- cron
- GitHub Actions
- server-level schedulers
- manual terminal commands

This phase should not add a daemon, persistent worker, cloud scheduler, or queue system.

## In Scope

- one-shot CLI script for price check run-all
- npm script for local execution
- safe default run controls
- CLI flags:
  - `--dry-run`
  - `--cooldown-minutes`
  - `--max-sources`
  - `--force`
- clear console summary output
- non-zero exit code on fatal runner errors
- no external test calls
- tests with mocked/local behavior
- documentation for scheduler usage examples

## Out of Scope

Do not implement:

- daemon/background process
- cloud scheduler
- persistent queue
- recurring loop inside Node
- frontend dashboard
- email/SMS/push notifications
- Google Places/maps
- AI features
- new platform parsers
- Yardi profile
- new profile lifecycle work
- new scraping behavior
- real external website tests
- stealth/proxy/CAPTCHA behavior

## CLI Command

Add an npm script, for example:

```bash
npm run price-check:run
```

Support options:

```bash
npm run price-check:run -- --dry-run
npm run price-check:run -- --cooldown-minutes 360
npm run price-check:run -- --max-sources 20
npm run price-check:run -- --force
```

Exact argument parsing can follow existing project style.

## Safe Defaults

Use safe defaults:

```text
cooldownMinutes: 360
maxSources: optional or conservative if already appropriate
force: false
dryRun: false
```

If defaults differ, document them.

## Behavior

The CLI should:

1. initialize the same repository/scheduled price check service used by the API
2. call run-all with parsed options
3. print a concise summary:
   - startedAt
   - finishedAt
   - dryRun
   - watchItemsScanned
   - sourcesSelected
   - sourcesSkipped
   - sourcesSucceeded
   - sourcesFailed
   - sourcesNeedsReview
4. print skipped reasons when present
5. exit with code 0 if the run completes, even if some sources failed
6. exit non-zero only for fatal runner errors, invalid CLI args, or initialization errors

## Scheduler Examples

Document examples:

### Windows Task Scheduler

Example command:

```text
Program: npm.cmd
Arguments: run price-check:run -- --cooldown-minutes 360 --max-sources 50
Start in: <project directory>
```

### cron

```bash
0 */6 * * * cd /path/to/project && npm run price-check:run -- --cooldown-minutes 360 --max-sources 50
```

Do not implement scheduler installation.

## Testing

Add tests for:

1. CLI argument parsing for dry-run.
2. CLI argument parsing for cooldownMinutes.
3. CLI argument parsing for maxSources.
4. CLI argument parsing for force.
5. invalid CLI args produce clear failure.
6. CLI calls scheduled price check service with parsed options.
7. CLI output includes summary counts.
8. partial source failures do not force non-zero exit.
9. fatal runner error returns non-zero exit.
10. existing Phase 1-7C tests still pass.

Tests must not hit real external websites.

## Acceptance Criteria

Phase 7D is complete when:

- npm script exists for one-shot price check runner
- CLI supports dry-run/cooldown/maxSources/force
- CLI uses existing scheduled price check service
- CLI prints clear summary
- CLI exits 0 for completed runs even if some sources failed
- CLI exits non-zero for invalid args/fatal setup errors
- docs include Windows Task Scheduler and cron examples
- tests use mocks/local behavior only
- lint, format, profile validation, tests, Prisma generate, and Prisma validate pass
