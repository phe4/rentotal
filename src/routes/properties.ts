import { Router } from "express";
import type { Repository } from "../types.js";
import { HttpError, sendError } from "../validation/http.js";
import { propertyData, readBody, sourceData } from "./helpers.js";

export function propertiesRouter(repository: Repository): Router {
  const router = Router();

  router.post("/properties", async (req, res) => {
    try {
      const data = propertyData(readBody(req.body));
      res
        .status(201)
        .json(await repository.createProperty(data as { name: string }));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/properties", async (_req, res) => {
    res.json(await repository.listProperties());
  });

  router.get("/properties/:id", async (req, res) => {
    const property = await repository.getProperty(req.params.id);
    if (!property)
      return res.status(404).json({ error: "Property not found." });
    res.json(property);
  });

  router.patch("/properties/:id", async (req, res) => {
    try {
      const property = await repository.updateProperty(
        req.params.id,
        propertyData(readBody(req.body), false),
      );
      if (!property) throw new HttpError(404, "Property not found.");
      res.json(property);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete("/properties/:id", async (req, res) => {
    const deleted = await repository.deleteProperty(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Property not found." });
    res.status(204).send();
  });

  router.post("/properties/:id/sources", async (req, res) => {
    try {
      const source = await repository.createPropertySource(
        sourceData(readBody(req.body), req.params.id),
      );
      if (!source) throw new HttpError(404, "Property not found.");
      res.status(201).json(source);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/properties/:id/sources", async (req, res) => {
    res.json(await repository.listPropertySources(req.params.id));
  });

  router.delete("/property-sources/:sourceId", async (req, res) => {
    const deleted = await repository.deletePropertySource(req.params.sourceId);
    if (!deleted)
      return res.status(404).json({ error: "Property source not found." });
    res.status(204).send();
  });

  router.get("/properties/:id/price-snapshots", async (req, res) => {
    res.json(await repository.listPriceSnapshots(req.params.id));
  });

  router.get("/properties/:id/latest-price", async (req, res) => {
    res.json(await repository.getLatestPriceSnapshot(req.params.id));
  });

  return router;
}
