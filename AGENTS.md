# AGENTS.md

## Project

This project is a rental/apartment watch list and price tracking platform.

The long-term goal is to build an AI-powered apartment research assistant, but the current implementation should stay backend-first and data-first.

## Current Phase

Current phase: Phase 5 - Direct JSON endpoint discovery.

Build only:

- Phase 0 + Phase 1 foundation
- HTTP scraper foundation
- scrape task and scrape run APIs
- conservative generic HTML rent parsing
- raw page metadata or small raw text storage
- price snapshots created only from parsed rent data
- effective rent calculation
- price history/latest price APIs
- basic stored alert generation and deduplication
- Playwright fallback for dynamic pages
- direct JSON endpoint discovery

Do not implement later phases unless explicitly requested.

## Scope Rules

Do not implement unless explicitly requested:

- real scraping
- Playwright
- Google Places
- map UI
- AI calls
- embeddings
- pgvector
- review crawling
- social/forum crawling
- scoring/recommendations
- authentication
- payment
- complex frontend

## Architecture Principles

- Keep the core database relational.
- Prefer PostgreSQL + Prisma.
- Keep modules separated:
  - properties
  - property-sources
  - watch-list
  - price-tracking
  - scraping
  - alerts
  - documents
- Store external source metadata whenever possible.
- Do not overwrite historical price data.
- Future price data should be stored as snapshots.
- AI-generated data must not directly overwrite core data in future phases.

## Data Rules

Every external source should preserve:

- source type
- source URL
- external ID if available
- metadata/raw data when practical
- created/updated timestamps

## Coding Rules

- Use TypeScript.
- Keep changes focused and reviewable.
- Do not make unrelated refactors.
- Do not delete unrelated files.
- Follow the existing framework and package manager if the repo already exists.
- If no framework exists, prefer a minimal Node.js/Express backend.

## Testing Rules

For every new feature:

- add or update tests when practical
- run existing tests if configured
- report commands run and any failures

## Future Phases

See `docs/roadmap.md`.

For phase-specific work, follow the user prompt first, but never violate the long-term scope rules in this file unless the user explicitly asks to update `AGENTS.md`.
