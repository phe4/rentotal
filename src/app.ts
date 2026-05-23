import cors from "cors";
import express from "express";
import type { Repository } from "./types.js";
import { alertsRouter } from "./routes/alerts.js";
import { propertiesRouter } from "./routes/properties.js";
import { watchIntakesRouter } from "./routes/watchIntakes.js";
import { watchItemsRouter } from "./routes/watchItems.js";
import { watchListsRouter } from "./routes/watchLists.js";

export function createApp(repository: Repository) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use(propertiesRouter(repository));
  api.use(watchListsRouter(repository));
  api.use(watchItemsRouter(repository));
  api.use(watchIntakesRouter(repository));
  api.use(alertsRouter(repository));
  app.use("/api", api);

  return app;
}
