import { readFileSync } from "node:fs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import {
  detectJsonEndpointCandidate,
  type BrowserCollector,
} from "../src/collectors/browserCollector.js";
import type { DirectJsonCollector } from "../src/collectors/directJsonCollector.js";
import { InMemoryRepository } from "../src/db/inMemoryRepository.js";
import { cmsSiteManagerParser } from "../src/parsers/cmsSiteManagerParser.js";
import { genericHtmlRentParser } from "../src/parsers/genericHtmlRentParser.js";
import { parseGenericJsonRent } from "../src/parsers/genericJsonRentParser.js";
import { unwrapJsonp } from "../src/parsers/jsonpUtils.js";
import { knockDoorwayParser } from "../src/parsers/knockDoorwayParser.js";
import { parseJsonWithRegistry } from "../src/parsers/parserRegistry.js";
import {
  cmsSiteManagerProfile,
  findProfileById,
  platformProfileDomainParser,
} from "../src/parsers/platformProfileRegistry.js";
import {
  numberFromValue,
  parseWithPlatformProfile,
  profileMatchesUrl,
  type PlatformProfile,
} from "../src/parsers/platformProfile.js";
import { cmsSiteManagerValidationCases } from "../src/parsers/platformProfileValidationCases.js";
import { validateProfileCase } from "../src/parsers/platformProfileValidation.js";
import { calculateEffectiveRent } from "../src/services/effectiveRent.js";
import type { PriceSnapshotRecord } from "../src/types.js";

let repository: InMemoryRepository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repository = new InMemoryRepository();
  app = createApp(repository);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status: number, text: string, contentType = "text/html") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? contentType : null,
      },
      text: async () => text,
    })),
  );
}

function fixtureJson(path: string): unknown {
  return JSON.parse(readFileSync(`test/fixtures/${path}`, "utf8"));
}

function fixtureText(path: string): string {
  return readFileSync(`test/fixtures/${path}`, "utf8");
}

describe("Phase 1 API", () => {
  it("creates a property", async () => {
    const response = await request(app)
      .post("/api/properties")
      .send({ name: "Park View Apartments" })
      .expect(201);

    expect(response.body.name).toBe("Park View Apartments");
    expect(response.body.normalizedName).toBe("park view apartments");
  });

  it("adds a property source", async () => {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Source Test" })
      .expect(201);

    const response = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({
        sourceType: "OFFICIAL_SITE",
        sourceUrl: "https://example.com/apartments",
      })
      .expect(201);

    expect(response.body.propertyId).toBe(property.body.id);
    expect(response.body.sourceType).toBe("OFFICIAL_SITE");
  });

  it("creates a watch intake", async () => {
    const response = await request(app)
      .post("/api/watch-intakes")
      .send({ inputType: "PROPERTY_NAME", inputValue: "The Ellington" })
      .expect(201);

    expect(response.body.inputValue).toBe("The Ellington");
    expect(response.body.parsedStatus).toBe("PENDING");
  });

  it("creates a watch item from a manual property name", async () => {
    const response = await request(app)
      .post("/api/watch-items")
      .send({ name: "Manual Towers", notes: "Near transit" })
      .expect(201);

    expect(response.body.propertyId).toBeTruthy();
    expect(response.body.status).toBe("WATCHING");
    expect(await repository.listWatchIntakes()).toHaveLength(1);
  });

  it("creates a watch item from a URL", async () => {
    const response = await request(app)
      .post("/api/watch-items")
      .send({
        sourceUrl: "https://example.com/floorplans",
        inputType: "FLOORPLAN_URL",
        inputValue: "https://example.com/floorplans",
      })
      .expect(201);

    const sources = await repository.listPropertySources(
      response.body.propertyId,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceType).toBe("FLOORPLAN_URL");
  });

  it("creates a property source from URL-like inputValue when sourceUrl is omitted", async () => {
    const inputValue = "https://www.fairwayglen.com/floor-plans?utm_knock=g";
    const response = await request(app)
      .post("/api/watch-items")
      .send({
        inputType: "FLOORPLAN_URL",
        inputValue,
        name: "Manual Test Apartment",
        targetBedrooms: 1,
        targetBathrooms: 1,
        targetBudgetMax: 2900,
      })
      .expect(201);

    const sources = await repository.listPropertySources(
      response.body.propertyId,
    );
    const intakes = await repository.listWatchIntakes();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceType).toBe("FLOORPLAN_URL");
    expect(sources[0]?.sourceUrl).toBe(inputValue);
    expect(intakes[0]?.inputValue).toBe(inputValue);
  });

  it("does not create a property source from PROPERTY_NAME inputValue", async () => {
    const response = await request(app)
      .post("/api/watch-items")
      .send({
        inputType: "PROPERTY_NAME",
        inputValue: "Manual Test Apartment",
        targetBedrooms: 1,
      })
      .expect(201);

    const sources = await repository.listPropertySources(
      response.body.propertyId,
    );
    expect(sources).toHaveLength(0);
  });

  it("still creates a property source when explicit sourceUrl is provided", async () => {
    const response = await request(app)
      .post("/api/watch-items")
      .send({
        inputType: "PROPERTY_NAME",
        inputValue: "Manual Test Apartment",
        sourceUrl: "https://example.com/manual-test",
      })
      .expect(201);

    const sources = await repository.listPropertySources(
      response.body.propertyId,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceType).toBe("MANUAL");
    expect(sources[0]?.sourceUrl).toBe("https://example.com/manual-test");
  });

  it("creates a property source when a URL is added to an existing property watch item", async () => {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Existing Property" })
      .expect(201);

    await request(app)
      .post("/api/watch-items")
      .send({
        propertyId: property.body.id,
        sourceUrl: "https://example.com/existing",
        inputType: "OFFICIAL_WEBSITE_URL",
      })
      .expect(201);

    const sources = await repository.listPropertySources(property.body.id);
    const intakes = await repository.listWatchIntakes();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceType).toBe("OFFICIAL_SITE");
    expect(intakes[0]?.inputValue).toBe("https://example.com/existing");
  });

  it("gets watch items", async () => {
    await request(app)
      .post("/api/watch-items")
      .send({ name: "List Me" })
      .expect(201);

    const response = await request(app).get("/api/watch-items").expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].propertyId).toBeTruthy();
  });

  it("returns null for latest price when no snapshot exists", async () => {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "No Price Yet" })
      .expect(201);

    const response = await request(app)
      .get(`/api/properties/${property.body.id}/latest-price`)
      .expect(200);

    expect(response.body).toBeNull();
  });

  it("marks an alert as read", async () => {
    const alert = await repository.createAlertForTest({
      propertyId: null,
      watchListItemId: null,
      alertType: "NEEDS_REVIEW",
      title: "Needs review",
      message: "A source needs review.",
      severity: "INFO",
      isRead: false,
    });

    const response = await request(app)
      .patch(`/api/alerts/${alert.id}/read`)
      .expect(200);

    expect(response.body.isRead).toBe(true);
  });
});

describe("Phase 2 HTTP scraper API", () => {
  async function createSource(sourceUrl = "https://example.com/rent") {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Scrape Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({ sourceType: "OFFICIAL_SITE", sourceUrl })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  it("creates a scrape task", async () => {
    const { source } = await createSource();

    const response = await request(app)
      .post("/api/scrape-tasks")
      .send({ sourceId: source.id })
      .expect(201);

    expect(response.body.sourceId).toBe(source.id);
    expect(response.body.taskType).toBe("PRICE_CHECK");
    expect(response.body.crawlerTier).toBe("HTTP");

    const list = await request(app).get("/api/scrape-tasks").expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("runs a scrape task with mocked rent HTML and creates a scrape run and price snapshot", async () => {
    const { property, source } = await createSource();
    const task = await request(app)
      .post("/api/scrape-tasks")
      .send({ sourceId: source.id })
      .expect(201);
    mockFetch(200, "<h1>1 Bed 1 Bath</h1><p>Starting at $2,500/mo</p>");

    const response = await request(app)
      .post(`/api/scrape-tasks/${task.body.id}/run`)
      .expect(200);

    expect(response.body.run.status).toBe("SUCCEEDED");
    expect(response.body.run.itemsFound).toBe(1);
    expect(response.body.priceSnapshots[0].baseRent).toBe(2500);

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(1);
  });

  it("runs source scrape with no rent and creates no price snapshot", async () => {
    const { property, source } = await createSource();
    mockFetch(200, "<p>Beautiful courtyard and renovated lobby.</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.status).toBe("PARTIAL");
    expect(response.body.priceSnapshots).toHaveLength(0);

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(0);
  });

  it("handles invalid source URLs gracefully", async () => {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Invalid URL" })
      .expect(201);
    const source = await repository.createPropertySource({
      propertyId: property.body.id,
      sourceType: "OFFICIAL_SITE",
      sourceUrl: "ftp://example.com/rent",
      sourceExternalId: null,
      isPrimary: false,
      metadata: null,
    });

    const response = await request(app)
      .post(`/api/property-sources/${source?.id}/scrape`)
      .expect(200);

    expect(response.body.run.status).toBe("FAILED");
    expect(response.body.run.errorMessage).toContain("HTTP(S)");
  });

  it("records a failed scrape run when HTTP fetch fails", async () => {
    const { source } = await createSource();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.status).toBe("FAILED");
    expect(response.body.run.errorMessage).toBe("network down");
  });

  it("gets one scrape run with related parsed snapshot info", async () => {
    const { source } = await createSource();
    mockFetch(200, "<p>Rent: $2500 1BR 1 BA 750 sq ft</p>");

    const scrape = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);
    const detail = await request(app)
      .get(`/api/scrape-runs/${scrape.body.run.id}`)
      .expect(200);

    expect(detail.body.run.id).toBe(scrape.body.run.id);
    expect(detail.body.priceSnapshots).toHaveLength(1);
  });
});

describe("Phase 3 price snapshots and alerts", () => {
  async function createSource(sourceUrl = "https://example.com/rent") {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Phase 3 Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({ sourceType: "OFFICIAL_SITE", sourceUrl })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  async function createSnapshot(
    propertyId: string,
    sourceId: string,
    data: Partial<PriceSnapshotRecord>,
  ) {
    return repository.createPriceSnapshot({
      propertyId,
      sourceId,
      floorplanName: data.floorplanName ?? null,
      unitNumber: data.unitNumber ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      sqft: data.sqft ?? null,
      baseRent: data.baseRent ?? null,
      effectiveRent: data.effectiveRent ?? data.baseRent ?? null,
      leaseTermMonths: data.leaseTermMonths ?? null,
      moveInDate: data.moveInDate ?? null,
      specialOfferText: data.specialOfferText ?? null,
      specialOfferValue: data.specialOfferValue ?? null,
      mandatoryFees: data.mandatoryFees ?? null,
      availabilityStatus: data.availabilityStatus ?? null,
      scrapedAt: data.scrapedAt ?? new Date(),
      rawData: data.rawData ?? null,
      parseStatus: "PARSED",
      errorMessage: null,
    });
  }

  it("calculates effective rent with base rent only", () => {
    expect(calculateEffectiveRent({ baseRent: 2500 })).toBe(2500);
  });

  it("calculates effective rent with lease term and concession", () => {
    expect(
      calculateEffectiveRent({
        baseRent: 2400,
        leaseTermMonths: 12,
        specialOfferValue: 2400,
      }),
    ).toBe(2200);
  });

  it("calculates effective rent with mandatory fees", () => {
    expect(
      calculateEffectiveRent({
        baseRent: 2400,
        leaseTermMonths: 12,
        specialOfferValue: 1200,
        mandatoryFees: 50,
      }),
    ).toBe(2350);
  });

  it("creates PRICE_DROPPED alert when effective rent decreases", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 3000,
      effectiveRent: 3000,
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=PRICE_DROPPED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
    expect(alerts.body[0].message).toContain("3000");
    expect(alerts.body[0].message).toContain("2500");
  });

  it("creates PRICE_INCREASED alert when effective rent increases", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2400,
      effectiveRent: 2400,
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,700</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=PRICE_INCREASED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates NEW_SPECIAL_OFFER alert", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2500,
      effectiveRent: 2500,
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500 1 month free</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=NEW_SPECIAL_OFFER")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates SPECIAL_OFFER_CHANGED alert", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2500,
      effectiveRent: 2500,
      specialOfferText: "1 month free",
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500 6 weeks free</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=SPECIAL_OFFER_CHANGED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates BECAME_AVAILABLE alert", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2500,
      effectiveRent: 2500,
      availabilityStatus: "UNAVAILABLE",
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500 Available now</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=BECAME_AVAILABLE")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates ENTERED_BUDGET alert for matching watch item", async () => {
    const { property, source } = await createSource();
    await request(app)
      .post("/api/watch-items")
      .send({ propertyId: property.id, targetBudgetMax: 2600 })
      .expect(201);
    mockFetch(200, "<p>Rent: $2,500</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=ENTERED_BUDGET")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
    expect(alerts.body[0].watchListItemId).toBeTruthy();
  });

  it("does not duplicate alerts for unchanged repeated scrape", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 3000,
      effectiveRent: 3000,
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);
    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=PRICE_DROPPED")
      .expect(200);
    const history = await request(app)
      .get(`/api/properties/${property.id}/price-history`)
      .expect(200);
    expect(alerts.body).toHaveLength(1);
    expect(history.body).toHaveLength(2);
  });

  it("allows a legitimate later price change after duplicate snapshot suppression", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 3000,
      effectiveRent: 3000,
      scrapedAt: new Date("2026-01-01"),
    });
    mockFetch(200, "<p>Rent: $2,500</p>");
    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);
    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    mockFetch(200, "<p>Rent: $2,400</p>");
    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=PRICE_DROPPED")
      .expect(200);
    const history = await request(app)
      .get(`/api/properties/${property.id}/price-history`)
      .expect(200);
    expect(alerts.body).toHaveLength(2);
    expect(
      history.body.map((snapshot: PriceSnapshotRecord) => snapshot.baseRent),
    ).toEqual([3000, 2500, 2400]);
  });

  it("does not duplicate ENTERED_BUDGET alerts for repeated unchanged scrape", async () => {
    const { property, source } = await createSource();
    await request(app)
      .post("/api/watch-items")
      .send({ propertyId: property.id, targetBudgetMax: 2600 })
      .expect(201);
    mockFetch(200, "<p>Rent: $2,500</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);
    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=ENTERED_BUDGET")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates SCRAPE_FAILED alert for scrape failure", async () => {
    const { source } = await createSource();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=SCRAPE_FAILED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("creates NEEDS_REVIEW alert for parser no-rent partial result", async () => {
    const { source } = await createSource();
    mockFetch(200, "<p>Call for availability</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const alerts = await request(app)
      .get("/api/alerts?alertType=NEEDS_REVIEW")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("latest price returns newest snapshot", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2200,
      effectiveRent: 2200,
      scrapedAt: new Date("2026-01-01"),
    });
    await createSnapshot(property.id, source.id, {
      baseRent: 2400,
      effectiveRent: 2400,
      scrapedAt: new Date("2026-02-01"),
    });

    const latest = await request(app)
      .get(`/api/properties/${property.id}/latest-price`)
      .expect(200);
    expect(latest.body.baseRent).toBe(2400);
  });

  it("price history returns chronological snapshots", async () => {
    const { property, source } = await createSource();
    await createSnapshot(property.id, source.id, {
      baseRent: 2400,
      effectiveRent: 2400,
      scrapedAt: new Date("2026-02-01"),
    });
    await createSnapshot(property.id, source.id, {
      baseRent: 2200,
      effectiveRent: 2200,
      scrapedAt: new Date("2026-01-01"),
    });

    const history = await request(app)
      .get(`/api/properties/${property.id}/price-history`)
      .expect(200);
    expect(
      history.body.map((snapshot: PriceSnapshotRecord) => snapshot.baseRent),
    ).toEqual([2200, 2400]);
  });
});

describe("Phase 4 browser fallback", () => {
  async function createSource(sourceUrl = "https://example.com/dynamic") {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Phase 4 Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({ sourceType: "OFFICIAL_SITE", sourceUrl })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  function enableBrowserFallback(browserCollector: BrowserCollector) {
    app = createApp(repository, {
      scrapeService: {
        enableBrowserFallback: true,
        browserCollector,
      },
    });
  }

  it("does not call browser fallback when HTTP parser succeeds", async () => {
    const browserCollector = vi.fn<BrowserCollector>();
    enableBrowserFallback(browserCollector);
    const { source } = await createSource();
    mockFetch(200, "<p>Rent: $2,500</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("HTTP");
    expect(response.body.priceSnapshots).toHaveLength(1);
    expect(browserCollector).not.toHaveBeenCalled();
  });

  it("does not call browser fallback when HTTP collection fails", async () => {
    const browserCollector = vi.fn<BrowserCollector>();
    enableBrowserFallback(browserCollector);
    const { source } = await createSource();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("HTTP");
    expect(response.body.run.status).toBe("FAILED");
    expect(response.body.run.errorMessage).toBe("network down");
    expect(browserCollector).not.toHaveBeenCalled();
  });

  it("calls browser fallback when HTTP parser finds no rent", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,750</p>",
      contentHash: "browser-rent",
      rendered: true,
    }));
    enableBrowserFallback(browserCollector);
    const { property, source } = await createSource();
    mockFetch(200, "<p>Loading availability...</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(browserCollector).toHaveBeenCalledTimes(1);
    expect(response.body.run.crawlerTier).toBe("BROWSER");
    expect(response.body.run.status).toBe("SUCCEEDED");
    expect(response.body.priceSnapshots[0].baseRent).toBe(2750);

    const runs = await request(app).get("/api/scrape-runs").expect(200);
    const crawlerTiers = runs.body.map(
      (run: { crawlerTier: string }) => run.crawlerTier,
    );
    expect(crawlerTiers).toContain("HTTP");
    expect(crawlerTiers).toContain("BROWSER");

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(1);
  });

  it("browser fallback with no rent creates NEEDS_REVIEW and no fake snapshot", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered page still says call for availability.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
    }));
    enableBrowserFallback(browserCollector);
    const { property, source } = await createSource();
    mockFetch(200, "<p>Loading availability...</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("BROWSER");
    expect(response.body.run.status).toBe("PARTIAL");
    expect(response.body.priceSnapshots).toHaveLength(0);

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(0);

    const alerts = await request(app)
      .get("/api/alerts?alertType=NEEDS_REVIEW")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("browser failure creates SCRAPE_FAILED", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async () => {
      throw new Error("browser timeout");
    });
    enableBrowserFallback(browserCollector);
    const { source } = await createSource();
    mockFetch(200, "<p>Loading availability...</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("BROWSER");
    expect(response.body.run.status).toBe("FAILED");
    expect(response.body.run.errorMessage).toBe("browser timeout");

    const alerts = await request(app)
      .get("/api/alerts?alertType=SCRAPE_FAILED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });
});

describe("Phase 5 direct JSON discovery", () => {
  async function createSource(metadata?: Record<string, unknown>) {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Phase 5 Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({
        sourceType: "OFFICIAL_SITE",
        sourceUrl: "https://example.com/dynamic",
        metadata,
      })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  function appWithCollectors(options: {
    directJsonCollector?: DirectJsonCollector;
    browserCollector?: BrowserCollector;
  }) {
    app = createApp(repository, {
      scrapeService: {
        enableBrowserFallback: true,
        ...options,
      },
    });
  }

  it("uses direct JSON first when preferred endpoint metadata exists", async () => {
    const directJsonCollector = vi.fn<DirectJsonCollector>(
      async (endpoint) => ({
        url: endpoint.url,
        statusCode: 200,
        contentType: "application/json",
        text: JSON.stringify({
          units: [{ unitNumber: "301", rent: 2450, beds: 1, baths: 1 }],
        }),
        json: { units: [{ unitNumber: "301", rent: 2450, beds: 1, baths: 1 }] },
        contentHash: "json-rent",
      }),
    );
    const browserCollector = vi.fn<BrowserCollector>();
    appWithCollectors({ directJsonCollector, browserCollector });
    const { property, source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: "https://example.com/api/availability",
        method: "GET",
        contentType: "application/json",
      },
    });
    mockFetch(200, "<p>Rent: $2,999</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(directJsonCollector).toHaveBeenCalledTimes(1);
    expect(browserCollector).not.toHaveBeenCalled();
    expect(response.body.run.crawlerTier).toBe("DIRECT_JSON");
    expect(response.body.priceSnapshots[0].baseRent).toBe(2450);

    const latest = await request(app)
      .get(`/api/properties/${property.id}/latest-price`)
      .expect(200);
    expect(latest.body.baseRent).toBe(2450);
  });

  it("direct JSON no-rent response falls back to HTTP/browser path", async () => {
    const directJsonCollector = vi.fn<DirectJsonCollector>(
      async (endpoint) => ({
        url: endpoint.url,
        statusCode: 200,
        contentType: "application/json",
        text: JSON.stringify({ build: 123, featureFlags: [1, 2, 3] }),
        json: { build: 123, featureFlags: [1, 2, 3] },
        contentHash: "json-no-rent",
      }),
    );
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,650</p>",
      contentHash: "browser-rent",
      rendered: true,
    }));
    appWithCollectors({ directJsonCollector, browserCollector });
    const { source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: "https://example.com/api/config",
        method: "GET",
      },
    });
    mockFetch(200, "<p>Loading prices...</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("BROWSER");
    expect(response.body.priceSnapshots[0].baseRent).toBe(2650);
    expect(browserCollector).toHaveBeenCalledTimes(1);
  });

  it("direct JSON HTTP failure falls back to HTTP/browser path", async () => {
    const directJsonCollector = vi.fn<DirectJsonCollector>(async () => {
      throw new Error("HTTP 500");
    });
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,700</p>",
      contentHash: "browser-rent",
      rendered: true,
    }));
    appWithCollectors({ directJsonCollector, browserCollector });
    const { source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: "https://example.com/api/availability",
        method: "GET",
      },
    });
    mockFetch(200, "<p>Loading prices...</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("BROWSER");
    expect(response.body.priceSnapshots[0].baseRent).toBe(2700);
    const alerts = await request(app)
      .get("/api/alerts?alertType=SCRAPE_FAILED")
      .expect(200);
    expect(alerts.body).toHaveLength(1);
  });

  it("browser fallback saves candidate JSON endpoint metadata", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,800</p>",
      contentHash: "browser-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: "https://example.com/api/availability",
          method: "GET",
          contentType: "application/json",
          confidence: 0.84,
          reason: "JSON response contained rent and floorplan-like keys",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: { rent: 2800, token: "do-not-store" },
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource({ existingMetadata: "preserve-me" });
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
      existingMetadata?: string;
    };
    expect(metadata.directJsonCandidates?.[0]?.url).toBe(
      "https://example.com/api/availability",
    );
    expect(metadata.directJsonCandidates?.[0]?.sample).toBeUndefined();
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(
      "https://example.com/api/availability",
    );
    expect(metadata.existingMetadata).toBe("preserve-me");
  });

  it("does not promote low-confidence browser JSON candidates", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,800</p>",
      contentHash: "browser-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: "https://example.com/api/maybe",
          method: "GET",
          contentType: "application/json",
          confidence: 0.45,
          reason: "Low confidence candidate",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: { rent: 2800, apiKey: "do-not-store" },
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    } | null;
    expect(metadata?.directJsonCandidates).toBeUndefined();
    expect(metadata?.preferredDirectJsonEndpoint).toBeUndefined();
  });

  it("stores community-only candidates without making them preferred", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,800</p>",
      contentHash: "browser-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
          method: "GET",
          contentType: "application/json",
          confidence: 0.9,
          reason: "JSON response contained rent and floorplan-like keys",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: { floorplans: [{ rent: 2800, floorPlanName: "A1" }] },
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(metadata.directJsonCandidates?.[0]?.url).toBe(
      "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
    );
    expect(metadata.preferredDirectJsonEndpoint).toBeUndefined();
  });

  it("passes post-load wait timing to browser fallback for late JSON capture", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url, options) => {
      expect(options?.postLoadWaitMs).toBe(3000);
      return {
        url,
        statusCode: 200,
        contentType: "text/html",
        text: "<p>Rendered rent: $2,800</p>",
        contentHash: "browser-rent",
        rendered: true,
        jsonCandidates: [
          {
            url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
            method: "GET",
            contentType: "application/json",
            confidence: 0.76,
            reason: "JSON response contained rent and floorplan-like keys",
            discoveredAt: "2026-05-24T00:00:00.000Z",
          },
        ],
      };
    });
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(
      "https://doorway-api.knockrentals.com/v1/property/2010930/units",
    );
  });

  it("candidate metadata excludes obvious analytics endpoints", () => {
    const candidate = detectJsonEndpointCandidate({
      url: "https://example.com/analytics/collect",
      contentType: "application/json",
      json: { rent: 2500, floorPlanName: "A1", availability: true },
    });

    expect(candidate).toBeNull();
  });

  it("candidate metadata excludes cookie and feature-flag endpoints", () => {
    const json = { rent: 2500, floorPlanName: "A1", availability: true };
    const cookieLaw = detectJsonEndpointCandidate({
      url: "https://cdn.cookielaw.org/consent/abc/en.json",
      contentType: "application/json",
      json,
    });
    const launchDarkly = detectJsonEndpointCandidate({
      url: "https://app.launchdarkly.com/sdk/evalx/project/context",
      contentType: "application/json",
      json,
    });

    expect(cookieLaw).toBeNull();
    expect(launchDarkly).toBeNull();
  });

  it("prefers Fairway Glen-like units endpoint over generic property candidates", async () => {
    const candidates = [
      "https://cdn.cookielaw.org/consent/abc/en.json",
      "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
      "https://doorway-api.knockrentals.com/v1/profile?code=g&domain=&refresh=true",
      "https://doorway-api.knockrentals.com/v1/property/2010930/phone-relays",
      "https://doorway-api.knockrentals.com/v1/property/2010930",
      "https://app.launchdarkly.com/sdk/evalx/project/context",
      "https://doorway-api.knockrentals.com/v1/property/2010930/units",
    ].map((url) => ({
      url,
      method: "GET" as const,
      contentType: "application/json",
      confidence: url.endsWith("/units") ? 0.76 : 0.9,
      reason: "JSON response contained rent and floorplan-like keys",
      discoveredAt: "2026-05-24T00:00:00.000Z",
      sample: { rent: 2800, floorPlanName: "A1", availability: true },
    }));
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered rent: $2,800</p>",
      contentHash: "browser-rent",
      rendered: true,
      jsonCandidates: candidates,
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource({
      existingMetadata: "preserve-me",
      directJsonCandidates: [
        {
          url: "https://cdn.cookielaw.org/consent/old/en.json",
          method: "GET",
          confidence: 0.95,
        },
      ],
      preferredDirectJsonEndpoint: {
        url: "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
        method: "GET",
        confidence: 0.9,
      },
    });
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
      existingMetadata?: string;
    };
    const urls =
      metadata.directJsonCandidates?.map((candidate) =>
        String(candidate.url),
      ) ?? [];
    expect(urls).toContain(
      "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
    );
    expect(urls).toContain(
      "https://doorway-api.knockrentals.com/v1/property/2010930/units",
    );
    expect(urls.some((url) => url.includes("cookielaw"))).toBe(false);
    expect(urls.some((url) => url.includes("launchdarkly"))).toBe(false);
    expect(urls.some((url) => url.includes("phone-relays"))).toBe(false);
    expect(urls.some((url) => url.includes("profile"))).toBe(false);
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(
      "https://doorway-api.knockrentals.com/v1/property/2010930/units",
    );
    expect(metadata.existingMetadata).toBe("preserve-me");
  });

  it("generic JSON parser creates rent items and avoids unrelated numbers", () => {
    const parsed = parseGenericJsonRent({
      floorplans: [
        {
          floorPlanName: "A1",
          unitNumber: "301",
          marketRent: 2550,
          bedrooms: 1,
          bathrooms: 1,
          squareFeet: 750,
          available: true,
        },
      ],
    });
    const unrelated = parseGenericJsonRent({
      analytics: { version: 42, build: 20260524, retries: 3 },
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.baseRent).toBe(2550);
    expect(parsed[0]?.floorplanName).toBe("A1");
    expect(unrelated).toHaveLength(0);
  });
});

describe("Phase 6A Knock/Doorway parser framework", () => {
  async function createSource(metadata?: Record<string, unknown>) {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "Knock Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({
        sourceType: "FLOORPLAN_URL",
        sourceUrl: "https://www.example.test/floor-plans?utm_knock=g",
        metadata,
      })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  function appWithCollectors(options: {
    directJsonCollector?: DirectJsonCollector;
    browserCollector?: BrowserCollector;
  }) {
    app = createApp(repository, {
      scrapeService: {
        enableBrowserFallback: true,
        ...options,
      },
    });
  }

  it("parser registry chooses Knock parser before generic JSON for Knock units URL", () => {
    const result = parseJsonWithRegistry({
      url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
      json: fixtureJson("knock/units.json"),
    });

    expect(result.parserName).toBe(knockDoorwayParser.name);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.items).toHaveLength(2);
  });

  it("Knock parser parses units JSON into ParsedPriceItem", () => {
    const result = knockDoorwayParser.parse({
      url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
      json: fixtureJson("knock/units.json"),
    });

    expect(result.items[0]).toMatchObject({
      floorplanName: "A1",
      unitNumber: "301",
      bedrooms: 1,
      bathrooms: 1,
      sqft: 742,
      baseRent: 2450,
      availabilityStatus: "AVAILABLE",
      moveInDate: "2026-06-01",
      specialOfferText: "1 month free",
    });
    expect(result.items[0]?.rawData).toBeTruthy();
  });

  it("Knock parser does not parse community-only JSON as rent snapshots", () => {
    const result = knockDoorwayParser.parse({
      url: "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
      json: fixtureJson("knock/community.json"),
    });

    expect(result.items).toHaveLength(0);
    expect(result.metadata?.endpointType).toBe("community");
  });

  it("Knock units endpoint creates snapshots through existing pipeline", async () => {
    const directJsonCollector = vi.fn<DirectJsonCollector>(
      async (endpoint) => ({
        url: endpoint.url,
        statusCode: 200,
        contentType: "application/json",
        text: JSON.stringify(fixtureJson("knock/units.json")),
        json: fixtureJson("knock/units.json"),
        contentHash: "knock-units",
      }),
    );
    const browserCollector = vi.fn<BrowserCollector>();
    appWithCollectors({ directJsonCollector, browserCollector });
    const { property, source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
        method: "GET",
        confidence: 0.95,
      },
    });
    mockFetch(200, "<p>Rent: $2,999</p>");

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("DIRECT_JSON");
    expect(response.body.priceSnapshots).toHaveLength(2);
    expect(response.body.priceSnapshots[0].baseRent).toBe(2450);
    const history = await request(app)
      .get(`/api/properties/${property.id}/price-history`)
      .expect(200);
    expect(history.body).toHaveLength(2);
  });

  it("Knock units endpoint can become preferred when confidence is high", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered page says call for availability.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
          method: "GET",
          contentType: "application/json",
          confidence: 0.95,
          reason: "Knock units endpoint candidate",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: fixtureJson("knock/units.json"),
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(
      "https://doorway-api.knockrentals.com/v1/property/2010930/units",
    );
  });

  it("Knock community endpoint is stored as candidate but not preferred", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered page says call for availability.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
          method: "GET",
          contentType: "application/json",
          confidence: 0.95,
          reason: "Knock community endpoint candidate",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: fixtureJson("knock/community.json"),
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(metadata.directJsonCandidates?.[0]?.url).toBe(
      "https://doorway-api.knockrentals.com/v1/property/community/2bc7dc811ebd5f29",
    );
    expect(metadata.preferredDirectJsonEndpoint).toBeUndefined();
  });

  it("low-confidence Knock-like data does not create snapshots", async () => {
    const directJsonCollector = vi.fn<DirectJsonCollector>(
      async (endpoint) => ({
        url: endpoint.url,
        statusCode: 200,
        contentType: "application/json",
        text: JSON.stringify(fixtureJson("knock/no-rent-units.json")),
        json: fixtureJson("knock/no-rent-units.json"),
        contentHash: "knock-no-rent",
      }),
    );
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>No prices here.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
    }));
    appWithCollectors({ directJsonCollector, browserCollector });
    const { property, source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
        method: "GET",
        confidence: 0.95,
      },
    });
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(0);
  });

  it("generic JSON parser remains fallback for non-Knock JSON", () => {
    const result = parseJsonWithRegistry({
      url: "https://example.com/api/availability",
      json: {
        floorplans: [
          {
            floorPlanName: "A1",
            unitNumber: "301",
            marketRent: 2550,
            bedrooms: 1,
            bathrooms: 1,
          },
        ],
      },
    });

    expect(result.parserName).toBe("generic-json-rent-parser");
    expect(result.items[0]?.baseRent).toBe(2550);
  });
});

describe("Phase 6B CmsSiteManager JSONP and HTML price ranges", () => {
  const cmsUnitsUrl =
    "https://www.fairwayglen.com/CmsSiteManager/callback.aspx?act=Proxy/GetUnits&available=true&honordisplayorder=true&siteid=1206682&bestprice=true&leaseterm=13&dateneeded=2026-05-31&callback=jQuery22406630535695412474_1779683287233&_=1779683287237";
  const normalizedCmsUnitsUrl =
    "https://www.fairwayglen.com/CmsSiteManager/callback.aspx?act=Proxy%2FGetUnits&available=true&honordisplayorder=true&siteid=1206682&bestprice=true&leaseterm=13&dateneeded=2026-05-31";

  async function createSource(metadata?: Record<string, unknown>) {
    const property = await request(app)
      .post("/api/properties")
      .send({ name: "CmsSiteManager Target" })
      .expect(201);
    const source = await request(app)
      .post(`/api/properties/${property.body.id}/sources`)
      .send({
        sourceType: "FLOORPLAN_URL",
        sourceUrl: "https://www.example.test/floor-plans",
        metadata,
      })
      .expect(201);
    return { property: property.body, source: source.body };
  }

  function appWithCollectors(options: {
    directJsonCollector?: DirectJsonCollector;
    browserCollector?: BrowserCollector;
  }) {
    app = createApp(repository, {
      scrapeService: {
        enableBrowserFallback: true,
        ...options,
      },
    });
  }

  it("JSONP unwrap parses valid callback JSON", () => {
    const parsed = unwrapJsonp('jQuery123({"units":[{"rent":"2719"}]});');

    expect(parsed).toEqual({ units: [{ rent: "2719" }] });
  });

  it("JSONP unwrap rejects invalid JSONP without eval", () => {
    expect(unwrapJsonp("alert(1)")).toBeNull();
    expect(unwrapJsonp("callback({invalid: true})")).toBeNull();
  });

  it("CmsSiteManager parser maps units JSONP into ParsedPriceItem", () => {
    const json = unwrapJsonp(fixtureText("cmssitemanager/units.jsonp"));
    const result = cmsSiteManagerParser.parse({
      url: cmsUnitsUrl,
      json,
    });

    expect(result.items[0]).toMatchObject({
      floorplanName: "A1",
      unitNumber: "153",
      bedrooms: 1,
      bathrooms: 1,
      sqft: 710,
      baseRent: 2719,
      leaseTermMonths: 13,
      moveInDate: "2026-05-31",
      mandatoryFees: 85,
      availabilityStatus: "AVAILABLE",
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("CmsSiteManager parser uses rent as baseRent and preserves totalRent in rawData", () => {
    const json = unwrapJsonp(fixtureText("cmssitemanager/units.jsonp"));
    const result = cmsSiteManagerParser.parse({
      url: cmsUnitsUrl,
      json,
    });
    const rawData = result.items[0]?.rawData as Record<string, unknown>;

    expect(result.items[0]?.baseRent).toBe(2719);
    expect(result.items[0]?.mandatoryFees).toBe(85);
    expect(rawData.totalRent).toBe("2804");
    expect(result.items[0]?.baseRent).not.toBe(2804);
  });

  it("direct JSON flow supports CmsSiteManager JSONP and creates snapshots", async () => {
    const { property, source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: normalizedCmsUnitsUrl,
        method: "GET",
        confidence: 0.94,
      },
    });
    mockFetch(
      200,
      fixtureText("cmssitemanager/units.jsonp"),
      "text/javascript",
    );

    const response = await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    expect(response.body.run.crawlerTier).toBe("DIRECT_JSON");
    expect(response.body.priceSnapshots[0]).toMatchObject({
      baseRent: 2719,
      mandatoryFees: 85,
      effectiveRent: 2804,
    });
    const history = await request(app)
      .get(`/api/properties/${property.id}/price-history`)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });

  it("no-rent units JSONP creates no snapshots", async () => {
    const { property, source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: normalizedCmsUnitsUrl,
        method: "GET",
        confidence: 0.94,
      },
    });
    mockFetch(
      200,
      fixtureText("cmssitemanager/no-rent-units.jsonp"),
      "text/javascript",
    );

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const snapshots = await request(app)
      .get(`/api/properties/${property.id}/price-snapshots`)
      .expect(200);
    expect(snapshots.body).toHaveLength(0);
  });

  it("Proxy/GetUnits endpoint can be stored as a high-confidence candidate after successful parse", async () => {
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered page says call for availability.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: cmsUnitsUrl,
          method: "GET",
          contentType: "text/javascript",
          confidence: 0.95,
          reason: "CmsSiteManager Proxy/GetUnits endpoint candidate",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: unwrapJsonp(fixtureText("cmssitemanager/units.jsonp")),
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource();
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(metadata.directJsonCandidates?.[0]?.url).toBe(normalizedCmsUnitsUrl);
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(
      normalizedCmsUnitsUrl,
    );
  });

  it("existing preferred Knock units endpoint is not overwritten by CmsSiteManager candidate", async () => {
    const knockUnitsUrl =
      "https://doorway-api.knockrentals.com/v1/property/2010930/units";
    const browserCollector = vi.fn<BrowserCollector>(async (url) => ({
      url,
      statusCode: 200,
      contentType: "text/html",
      text: "<p>Rendered page says call for availability.</p>",
      contentHash: "browser-no-rent",
      rendered: true,
      jsonCandidates: [
        {
          url: cmsUnitsUrl,
          method: "GET",
          contentType: "text/javascript",
          confidence: 0.95,
          reason: "CmsSiteManager Proxy/GetUnits endpoint candidate",
          discoveredAt: "2026-05-24T00:00:00.000Z",
          sample: unwrapJsonp(fixtureText("cmssitemanager/units.jsonp")),
        },
      ],
    }));
    appWithCollectors({ browserCollector });
    const { source } = await createSource({
      preferredDirectJsonEndpoint: {
        url: knockUnitsUrl,
        method: "GET",
        confidence: 0.95,
      },
    });
    mockFetch(200, "<p>Loading prices...</p>");

    await request(app)
      .post(`/api/property-sources/${source.id}/scrape`)
      .expect(200);

    const updated = await repository.getPropertySource(source.id);
    const metadata = updated?.metadata as {
      directJsonCandidates?: Array<Record<string, unknown>>;
      preferredDirectJsonEndpoint?: Record<string, unknown>;
    };
    expect(
      metadata.directJsonCandidates?.map((candidate) => candidate.url),
    ).toContain(normalizedCmsUnitsUrl);
    expect(metadata.preferredDirectJsonEndpoint?.url).toBe(knockUnitsUrl);
  });

  it("volatile callback and cachebuster params are stripped in metadata", () => {
    const candidate = detectJsonEndpointCandidate({
      url: cmsUnitsUrl,
      contentType: "text/javascript",
      json: unwrapJsonp(fixtureText("cmssitemanager/units.jsonp")),
    });

    expect(candidate?.url).toBe(normalizedCmsUnitsUrl);
    expect(candidate?.url).not.toContain("callback=");
    expect(candidate?.url).not.toContain("_=");
  });

  it("HTML price range parser extracts lower rent from a range", () => {
    const result = genericHtmlRentParser.parse({
      url: "https://example.com/floor-plans",
      text: fixtureText("cmssitemanager/floorplan-range.html"),
    });
    const rawData = result[0]?.rawData as Record<string, unknown>;

    expect(result).toHaveLength(1);
    expect(result[0]?.baseRent).toBe(2719);
    expect(rawData.maxRent).toBe(2853);
  });

  it("HTML price range parser does not parse fee or deposit ranges as rent", () => {
    const result = genericHtmlRentParser.parse({
      url: "https://example.com/floor-plans",
      text: "<p>Application fee $500 - $700. Security deposit $1,000.</p>",
    });

    expect(result).toHaveLength(0);
  });

  it("parser registry keeps generic fallback for non-CmsSiteManager JSON", () => {
    const result = parseJsonWithRegistry({
      url: "https://example.com/api/availability",
      json: {
        floorplans: [{ floorPlanName: "B1", unitNumber: "201", rent: 2550 }],
      },
    });

    expect(result.parserName).toBe("generic-json-rent-parser");
    expect(result.items[0]?.baseRent).toBe(2550);
  });
});

describe("Phase 6C Platform Profile Framework", () => {
  const cmsUnitsUrl =
    "https://www.fairwayglen.com/CmsSiteManager/callback.aspx?act=Proxy/GetUnits&siteid=1206682&callback=jQuery123&_=123";

  function cmsJson(): unknown {
    return unwrapJsonp(fixtureText("cmssitemanager/units.jsonp"));
  }

  function profile(overrides: Partial<PlatformProfile> = {}): PlatformProfile {
    return {
      ...cmsSiteManagerProfile,
      ...overrides,
      match: { ...cmsSiteManagerProfile.match, ...overrides.match },
      response: { ...cmsSiteManagerProfile.response, ...overrides.response },
      mapping: { ...cmsSiteManagerProfile.mapping, ...overrides.mapping },
      rawData: { ...cmsSiteManagerProfile.rawData, ...overrides.rawData },
      rules: { ...cmsSiteManagerProfile.rules, ...overrides.rules },
      endpointPromotion: {
        canPromote: cmsSiteManagerProfile.endpointPromotion!.canPromote,
        ...cmsSiteManagerProfile.endpointPromotion,
        ...overrides.endpointPromotion,
      },
    };
  }

  it("profile matcher matches CmsSiteManager URL and query", () => {
    expect(profileMatchesUrl(cmsSiteManagerProfile, cmsUnitsUrl)).toBe(true);
  });

  it("profile matcher does not match unrelated URLs", () => {
    expect(
      profileMatchesUrl(
        cmsSiteManagerProfile,
        "https://example.com/api/availability",
      ),
    ).toBe(false);
  });

  it("profile runtime unwraps JSONP through the existing JSONP utility", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      text: fixtureText("cmssitemanager/units.jsonp"),
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.baseRent).toBe(2719);
  });

  it("profile parser maps CmsSiteManager units into ParsedPriceItem", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      json: cmsJson(),
    });

    expect(items[0]).toMatchObject({
      floorplanName: "A1",
      unitNumber: "153",
      bedrooms: 1,
      bathrooms: 1,
      sqft: 710,
      baseRent: 2719,
      leaseTermMonths: 13,
      moveInDate: "2026-05-31",
      mandatoryFees: 85,
      availabilityStatus: "AVAILABLE",
    });
  });

  it("profile fallback fields work for unitNumber then name", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      json: {
        units: [
          {
            name: "Fallback Name",
            floorplanName: "A1",
            rent: "2719",
          },
        ],
      },
    });

    expect(items[0]?.unitNumber).toBe("Fallback Name");
  });

  it("profile nested path mapping works", () => {
    const nestedProfile = profile({
      response: { format: "json", arrayPath: "data.units" },
      mapping: {
        baseRent: "pricing.marketRent",
        unitNumber: "unit.number",
      },
    });
    const items = parseWithPlatformProfile({
      profile: nestedProfile,
      url: cmsUnitsUrl,
      json: {
        data: {
          units: [
            { pricing: { marketRent: "$2,719" }, unit: { number: "153" } },
          ],
        },
      },
    });

    expect(items[0]?.baseRent).toBe(2719);
    expect(items[0]?.unitNumber).toBe("153");
  });

  it("profile numeric normalization handles dollars, commas, and decimals", () => {
    expect(numberFromValue("$2,719")).toBe(2719);
    expect(numberFromValue("2,719")).toBe(2719);
    expect(numberFromValue("5.00")).toBe(5);
  });

  it("profile required field validation skips rows without baseRent", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      json: { units: [{ unitNumber: "153", floorplanName: "A1" }] },
    });

    expect(items).toHaveLength(0);
  });

  it("profile min and max baseRent checks reject bad values", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      json: {
        units: [
          { unitNumber: "low", rent: "200" },
          { unitNumber: "high", rent: "25000" },
        ],
      },
    });

    expect(items).toHaveLength(0);
  });

  it("profile rawData preserve keeps totalRent but does not use it as baseRent", () => {
    const items = parseWithPlatformProfile({
      profile: cmsSiteManagerProfile,
      url: cmsUnitsUrl,
      json: cmsJson(),
    });
    const rawData = items[0]?.rawData as Record<string, unknown>;

    expect(items[0]?.baseRent).toBe(2719);
    expect(rawData.totalRent).toBe("2804");
    expect(items[0]?.baseRent).not.toBe(2804);
  });

  it("profile rejects disallowed baseRent source fields", () => {
    const totalRentProfile = profile({
      mapping: { baseRent: "totalRent" },
      rules: {
        requiredFields: ["baseRent"],
        doNotUseAsBaseRent: ["totalRent"],
      },
    });
    const sqftProfile = profile({
      mapping: { baseRent: "squareFeet" },
      rules: { requiredFields: ["baseRent"] },
    });
    const feeProfile = profile({
      mapping: { baseRent: "mandatoryFeesDeposits" },
      rules: { requiredFields: ["baseRent"] },
    });

    expect(
      parseWithPlatformProfile({
        profile: totalRentProfile,
        url: cmsUnitsUrl,
        json: { units: [{ totalRent: "2804" }] },
      }),
    ).toHaveLength(0);
    expect(
      parseWithPlatformProfile({
        profile: sqftProfile,
        url: cmsUnitsUrl,
        json: { units: [{ squareFeet: "710" }] },
      }),
    ).toHaveLength(0);
    expect(
      parseWithPlatformProfile({
        profile: feeProfile,
        url: cmsUnitsUrl,
        json: { units: [{ mandatoryFeesDeposits: "850" }] },
      }),
    ).toHaveLength(0);
  });

  it("profile rawData preserve filters nested sensitive values", () => {
    const sensitiveProfile = profile({
      rawData: { preserve: ["details", "totalRent"] },
    });
    const items = parseWithPlatformProfile({
      profile: sensitiveProfile,
      url: cmsUnitsUrl,
      json: {
        units: [
          {
            rent: "2719",
            totalRent: "2804",
            details: {
              display: "safe",
              authToken: "secret-token",
              residentName: "private-name",
            },
          },
        ],
      },
    });
    const rawData = items[0]?.rawData as Record<string, unknown>;
    const details = rawData.details as Record<string, unknown>;

    expect(rawData.totalRent).toBe("2804");
    expect(details.display).toBe("safe");
    expect(details.authToken).toBeUndefined();
    expect(details.residentName).toBeUndefined();
  });

  it("DRAFT profiles do not run automatically", () => {
    const draft = profile({ status: "DRAFT" });

    expect(profileMatchesUrl(draft, cmsUnitsUrl)).toBe(false);
    expect(
      parseWithPlatformProfile({
        profile: draft,
        url: cmsUnitsUrl,
        json: cmsJson(),
      }),
    ).toHaveLength(0);
  });

  it("DISABLED profiles do not run automatically", () => {
    const disabled = profile({ status: "DISABLED" });

    expect(profileMatchesUrl(disabled, cmsUnitsUrl)).toBe(false);
    expect(
      parseWithPlatformProfile({
        profile: disabled,
        url: cmsUnitsUrl,
        json: cmsJson(),
      }),
    ).toHaveLength(0);
  });

  it("APPROVED profile parser runs automatically when selected", () => {
    const result = platformProfileDomainParser.parse({
      url: cmsUnitsUrl,
      json: cmsJson(),
    });

    expect(result.parserName).toBe("platform-profile-parser");
    expect(result.items[0]?.baseRent).toBe(2719);
  });

  it("existing Knock custom parser behavior remains intact", () => {
    const result = parseJsonWithRegistry({
      url: "https://doorway-api.knockrentals.com/v1/property/2010930/units",
      json: fixtureJson("knock/units.json"),
    });

    expect(result.parserName).toBe(knockDoorwayParser.name);
    expect(result.items[0]?.baseRent).toBe(2450);
  });

  it("existing CmsSiteManager custom parser behavior remains intact", () => {
    const result = parseJsonWithRegistry({
      url: cmsUnitsUrl,
      json: cmsJson(),
    });

    expect(result.parserName).toBe(cmsSiteManagerParser.name);
    expect(result.items[0]?.baseRent).toBe(2719);
  });
});

describe("Phase 6D Platform Profile Validation Tooling", () => {
  const [cmsValidationCase] = cmsSiteManagerValidationCases;

  function validationProfile(
    overrides: Partial<PlatformProfile> = {},
  ): PlatformProfile {
    return {
      ...cmsSiteManagerProfile,
      ...overrides,
      match: { ...cmsSiteManagerProfile.match, ...overrides.match },
      response: { ...cmsSiteManagerProfile.response, ...overrides.response },
      mapping: { ...cmsSiteManagerProfile.mapping, ...overrides.mapping },
      rawData: { ...cmsSiteManagerProfile.rawData, ...overrides.rawData },
      rules: { ...cmsSiteManagerProfile.rules, ...overrides.rules },
      endpointPromotion: {
        canPromote: cmsSiteManagerProfile.endpointPromotion!.canPromote,
        ...cmsSiteManagerProfile.endpointPromotion,
        ...overrides.endpointPromotion,
      },
    };
  }

  it("validator passes for CmsSiteManager fixture and expected output", () => {
    const profile = findProfileById(cmsValidationCase.profileId);

    expect(profile).toBeDefined();
    expect(
      validateProfileCase({
        profile: profile!,
        profileCase: cmsValidationCase,
      }),
    ).toMatchObject({
      passed: true,
      itemCount: 1,
      expectedCount: 1,
      errors: [],
    });
  });

  it("validator fails when expected item count differs", () => {
    const report = validateProfileCase({
      profile: cmsSiteManagerProfile,
      profileCase: {
        ...cmsValidationCase,
        expectedItems: [],
      },
    });

    expect(report.passed).toBe(false);
    expect(report.errors[0]).toContain(
      "Expected 0 parsed item(s) but received 1.",
    );
  });

  it("validator fails with a clear field mismatch error", () => {
    const report = validateProfileCase({
      profile: cmsSiteManagerProfile,
      profileCase: {
        ...cmsValidationCase,
        expectedItems: [{ baseRent: 9999 }],
      },
    });

    expect(report.passed).toBe(false);
    expect(report.errors[0]).toContain(
      "Item 0 field baseRent expected 9999 but received 2719.",
    );
  });

  it("validator can run a DRAFT profile explicitly", () => {
    const report = validateProfileCase({
      profile: validationProfile({ status: "DRAFT" }),
      profileCase: cmsValidationCase,
    });

    expect(report.passed).toBe(true);
    expect(report.itemCount).toBe(1);
  });

  it("validator can run a DISABLED profile explicitly", () => {
    const report = validateProfileCase({
      profile: validationProfile({ status: "DISABLED" }),
      profileCase: cmsValidationCase,
    });

    expect(report.passed).toBe(true);
    expect(report.itemCount).toBe(1);
  });

  it("normal runtime still only auto-runs APPROVED profiles", () => {
    const draft = validationProfile({ status: "DRAFT" });
    const disabled = validationProfile({ status: "DISABLED" });

    expect(profileMatchesUrl(draft, cmsValidationCase.input.url)).toBe(false);
    expect(profileMatchesUrl(disabled, cmsValidationCase.input.url)).toBe(
      false,
    );
    expect(
      parseWithPlatformProfile({
        profile: draft,
        url: cmsValidationCase.input.url,
        text: fixtureText("cmssitemanager/units.jsonp"),
      }),
    ).toHaveLength(0);
    expect(
      parseWithPlatformProfile({
        profile: disabled,
        url: cmsValidationCase.input.url,
        text: fixtureText("cmssitemanager/units.jsonp"),
      }),
    ).toHaveLength(0);
  });

  it("validation cases use local fixtures only", () => {
    expect(cmsValidationCase.input.fixturePath).toMatch(/^test\/fixtures\//);
    expect(cmsValidationCase.input.fixturePath).not.toMatch(/^https?:\/\//i);
  });

  it("validator rejects fixture paths outside test fixtures", () => {
    expect(() =>
      validateProfileCase({
        profile: cmsSiteManagerProfile,
        profileCase: {
          ...cmsValidationCase,
          input: {
            ...cmsValidationCase.input,
            fixturePath: "README.md",
          },
        },
      }),
    ).toThrow("Profile validation fixtures must be under test/fixtures.");
  });
});

describe("genericHtmlRentParser", () => {
  it("extracts a simple rent amount", () => {
    const result = genericHtmlRentParser.parse({
      url: "https://example.com",
      text: "1 Bed 1 Bath 750 sq ft Starting at $2,500/mo 6 weeks free",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.baseRent).toBe(2500);
    expect(result[0]?.bedrooms).toBe(1);
    expect(result[0]?.bathrooms).toBe(1);
    expect(result[0]?.sqft).toBe(750);
    expect(result[0]?.specialOfferText).toBe("6 weeks free");
  });

  it("does not hallucinate rent when no price exists", () => {
    const result = genericHtmlRentParser.parse({
      url: "https://example.com",
      text: "Call for availability. Spacious homes near transit.",
    });

    expect(result).toHaveLength(0);
  });
});
