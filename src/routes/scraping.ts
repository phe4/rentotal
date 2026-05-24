import { Router } from "express";
import type { Repository } from "../types.js";
import { watchPriorities } from "../types.js";
import {
  ScrapeService,
  type ScrapeServiceOptions,
} from "../services/scrapeService.js";
import { HttpError, sendError } from "../validation/http.js";
import {
  enumValue,
  optionalDate,
  optionalString,
} from "../validation/index.js";
import { readBody } from "./helpers.js";

export function scrapingRouter(
  repository: Repository,
  scrapeServiceOptions: ScrapeServiceOptions = {},
): Router {
  const router = Router();
  const scrapeService = new ScrapeService(repository, scrapeServiceOptions);

  router.post("/scrape-tasks", async (req, res) => {
    try {
      const body = readBody(req.body);
      const sourceId = optionalString(body, "sourceId") ?? null;
      const source = sourceId
        ? await repository.getPropertySource(sourceId)
        : null;
      if (sourceId && !source)
        throw new HttpError(404, "Property source not found.");

      const propertyId =
        optionalString(body, "propertyId") ?? source?.propertyId ?? null;
      if (propertyId && !(await repository.getProperty(propertyId))) {
        throw new HttpError(404, "Property not found.");
      }
      const crawlerTier = optionalString(body, "crawlerTier") ?? "HTTP";
      if (crawlerTier !== "HTTP") {
        throw new HttpError(
          400,
          "Only HTTP scrape tasks are supported; browser scraping runs only as fallback.",
        );
      }
      const taskType = optionalString(body, "taskType") ?? "PRICE_CHECK";
      if (taskType !== "PRICE_CHECK") {
        throw new HttpError(
          400,
          "Only PRICE_CHECK scrape tasks are supported in Phase 4.",
        );
      }

      const task = await repository.createScrapeTask({
        propertyId,
        sourceId,
        taskType,
        priority: enumValue(body, "priority", watchPriorities, "MEDIUM"),
        status: "PENDING",
        scheduledAt: optionalDate(body, "scheduledAt") ?? null,
        startedAt: null,
        finishedAt: null,
        retryCount: 0,
        maxRetries:
          typeof body.maxRetries === "number" && body.maxRetries >= 0
            ? body.maxRetries
            : 3,
        crawlerTier,
        errorMessage: null,
      });

      if (!task) throw new HttpError(400, "Unable to create scrape task.");
      res.status(201).json(task);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/scrape-tasks", async (_req, res) => {
    res.json(await repository.listScrapeTasks());
  });

  router.post("/scrape-tasks/:id/run", async (req, res) => {
    try {
      const task = await repository.getScrapeTask(req.params.id);
      if (!task) throw new HttpError(404, "Scrape task not found.");
      res.json(await scrapeService.runTask(task.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/property-sources/:sourceId/scrape", async (req, res) => {
    try {
      const source = await repository.getPropertySource(req.params.sourceId);
      if (!source) throw new HttpError(404, "Property source not found.");
      res.json(await scrapeService.runSource(source.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/scrape-runs", async (_req, res) => {
    res.json(await repository.listScrapeRuns());
  });

  router.get("/scrape-runs/:id", async (req, res) => {
    try {
      const run = await repository.getScrapeRun(req.params.id);
      if (!run) throw new HttpError(404, "Scrape run not found.");
      const priceSnapshots = run.propertyId
        ? (await repository.listPriceSnapshots(run.propertyId)).filter(
            (snapshot) => snapshot.sourceId === run.sourceId,
          )
        : [];
      res.json({ run, priceSnapshots });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
