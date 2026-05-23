import { Router } from "express";
import type { Repository } from "../types.js";
import { HttpError, sendError } from "../validation/http.js";
import { optionalString, requiredString } from "../validation/index.js";
import { readBody } from "./helpers.js";

export function watchListsRouter(repository: Repository): Router {
  const router = Router();

  router.get("/watch-lists", async (_req, res) => {
    res.json(await repository.listWatchLists());
  });

  router.post("/watch-lists", async (req, res) => {
    try {
      const body = readBody(req.body);
      const watchList = await repository.createWatchList({
        name: requiredString(body, "name"),
        description: optionalString(body, "description") ?? null,
      });
      res.status(201).json(watchList);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/watch-lists/:id", async (req, res) => {
    try {
      const watchList = await repository.getWatchList(req.params.id);
      if (!watchList) throw new HttpError(404, "Watch list not found.");
      res.json(watchList);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
