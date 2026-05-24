import cors from "cors";
import express from "express";
import type { Repository } from "./types.js";
import { alertsRouter } from "./routes/alerts.js";
import { propertiesRouter } from "./routes/properties.js";
import { scrapingRouter } from "./routes/scraping.js";
import { watchIntakesRouter } from "./routes/watchIntakes.js";
import { watchItemsRouter } from "./routes/watchItems.js";
import { watchListsRouter } from "./routes/watchLists.js";
import type { ScrapeServiceOptions } from "./services/scrapeService.js";

export function createApp(
  repository: Repository,
  options: { scrapeService?: ScrapeServiceOptions } = {},
) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use(propertiesRouter(repository));
  api.use(scrapingRouter(repository, options.scrapeService));
  api.use(watchListsRouter(repository));
  api.use(watchItemsRouter(repository));
  api.use(watchIntakesRouter(repository));
  api.use(alertsRouter(repository));
  app.use("/api", api);

  return app;
}
