# Rental Watch List Roadmap

## Product Direction

This project starts as a backend-first rental Watch List and price tracking tool.

Long-term vision:

- manually add apartments or URLs to a Watch List
- track price, availability, and special offers over time
- later discover apartments from maps or Google Places
- later analyze reviews, forums, and social posts
- later add AI research, semantic search, scoring, recommendations, and reports

## Phase 0: Foundation

Goal:
Create the project structure, database schema, basic modules, and setup instructions.

In scope:

- backend setup
- PostgreSQL + Prisma
- core database models
- basic CRUD patterns
- placeholder models for scraping, alerts, and AI-ready documents

Out of scope:

- real scraping
- AI
- map UI
- Google Places
- reviews/social crawling

## Phase 1: Watch List MVP

Goal:
Allow users to manually add apartments, URLs, addresses, or notes to a Watch List.

In scope:

- properties
- property sources
- watch lists
- watch list items
- watch intakes
- basic APIs
- latest price endpoint returning null when no snapshots exist
- simple alerts endpoint

Out of scope:

- actual price scraping
- Playwright
- AI
- complex frontend
- authentication

## Phase 2: HTTP Scraper

Goal:
Add the first real price collection mechanism using HTTP fetch and generic parsing.

In scope:

- HTTP collector
- generic HTML parser
- raw page storage
- scrape runs
- parse status
- parser interface

Out of scope:

- Playwright
- direct JSON endpoint discovery
- AI extraction

## Phase 3: Price Snapshots and Alerts

Goal:
Save price changes over time and generate basic alerts.

In scope:

- price snapshots
- effective rent calculation
- price diff logic
- alert generation
- snapshot history APIs

## Phase 4: Playwright Fallback

Goal:
Handle dynamic pages only when HTTP parsing fails.

In scope:

- Playwright worker
- resource blocking
- low concurrency
- DOM parsing fallback
- network response capture preparation

## Phase 5: Direct JSON Endpoint Discovery

Goal:
Discover internal availability APIs from dynamic websites and reuse them for faster checks.

In scope:

- network response capture
- endpoint metadata storage
- direct JSON collector
- generic JSON parser

## Phase 6A: Parser Framework and Knock/Doorway Support

Goal:
Add a domain-specific parser framework and the first platform-specific support for Knock / Doorway API.

In scope:

- parser registry
- platform detection framework
- Knock / Doorway API detection
- Knock units endpoint parser
- safe preferred endpoint promotion for units/availability data
- mocked fixtures only

Out of scope:

- Entrata
- Yardi
- Greystar
- AvalonBay
- Essex
- other platform parsers

## Phase 6B: CmsSiteManager JSONP Adapter and HTML Price Range Fallback

Goal:
Add CmsSiteManager / Proxy/GetUnits JSONP support and conservative rendered HTML price range parsing.

In scope:

- JSONP unwrap utility
- CmsSiteManager / Proxy/GetUnits detection
- CmsSiteManager units parser
- direct endpoint support for JSONP where appropriate
- HTML floorplan price range fallback
- mocked fixtures only

Out of scope:

- replacing Knock/Doorway behavior
- Entrata
- Yardi
- Greystar
- other platform parsers

## Phase 6C: Platform Profile Framework

Goal:
Add a deterministic Platform Profile framework for mapping-based platform extraction.

In scope:

- PlatformProfile type
- profile matcher and registry
- profile parser runtime
- JSON and JSONP profile support
- field mapping, nested paths, fallback fields, and numeric normalization
- CmsSiteManager profile as the first example
- existing custom parsers remain intact

Out of scope:

- Entrata production profile
- Yardi production profile
- DB-backed profiles
- AI-generated profile drafts
- replacing Knock/Doorway or CmsSiteManager behavior

## Phase 6D: Platform Profile Validation Tooling

Goal:
Add deterministic validation tooling for platform profiles using local fixtures and expected parsed output.

## Phase 6E: Entrata Draft Profile

Goal:
Add an Entrata platform profile draft using local fixtures and validation tooling.

Status:
Draft-only. The current Entrata profile must not auto-run in production unless it is based on real sanitized Entrata sample data, validation passes, and a human explicitly approves it.

## Phase 6F: File-Based Profile Loading

Goal:
Load platform profiles from reviewed local files instead of keeping every profile in code.

Complete.

## Phase 6G: Profile Draft Generation From Sample Data

Goal:
Generate or assist profile drafts from sanitized sample responses while keeping generated profiles in DRAFT status.

Complete.

## Phase 6H: Platform Profile Approval Workflow

Goal:
Add a local CLI approval workflow so a reviewed DRAFT profile can be copied to approved only after validation passes and explicit confirmation is provided.

Complete.

## Phase 7A: Scheduled Price Check Worker

Goal:
Add a local/manual price-check runner foundation that can later be called by cron, cloud scheduler, BullMQ, or Airflow.

Current preparation phase. Do not implement cloud scheduling, persistent queues, new scraping behavior, Yardi, AI, maps, frontend, or notification delivery in this phase.

## Phase 6I: Yardi Draft Profile From Sample Data

Goal:
Add a Yardi draft profile only from sanitized sample data and validation cases.

Future only.

## Phase 7: Google Places and Map Discovery

Goal:
Discover apartment candidates from a city, ZIP, or map area.

In scope:

- Google Places API
- discovered properties staging table
- Add to Watch List flow
- entity resolution preparation

## Phase 8: Reviews, Social, and Forum Data

Goal:
Collect non-price research data for watched properties.

Potential sources:

- Google reviews
- Yelp
- Apartments.com reviews
- Reddit
- Craigslist
- Facebook Marketplace
- Xiaohongshu
- 1Point3Acres
- Douban

## Phase 9: AI, pgvector, and Agent Research

Goal:
Add AI-powered summarization, semantic search, and property research.

In scope:

- document chunks
- embeddings
- pgvector
- AI extraction
- agent findings
- citations/evidence storage

Rule:
AI findings should not directly overwrite core data.

## Phase 10: Scoring and Recommendations

Goal:
Turn collected data into decision support.

In scope:

- price score
- discount score
- trend score
- review/risk score
- availability score
- overall score
- daily report
- recommendation explanation

Core product concept:
There are two future product entry points:

1. Watch List Mode:
   User manually adds an apartment, official website URL, floorplan URL, Zillow URL, Apartments.com URL, Google Maps URL, address, or free text.
   The system stores this as a watch item and associates it with a property.

2. Discovery Mode:
   In the future, users will discover properties from maps or Google Places and add them to the Watch List.
   Do not implement Discovery Mode now, but leave clean model space for it.
