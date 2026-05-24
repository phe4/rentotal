import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryRepository } from "../src/db/inMemoryRepository.js";
import { genericHtmlRentParser } from "../src/parsers/genericHtmlRentParser.js";

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
