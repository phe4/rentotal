import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryRepository } from "../src/db/inMemoryRepository.js";

let repository: InMemoryRepository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repository = new InMemoryRepository();
  app = createApp(repository);
});

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
