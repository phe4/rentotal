import { Router } from "express";
import type { Repository } from "../types.js";
import { HttpError, sendError } from "../validation/http.js";
import { intakeData, readBody } from "./helpers.js";

export function watchIntakesRouter(repository: Repository): Router {
  const router = Router();

  router.post("/watch-intakes", async (req, res) => {
    try {
      const intake = await repository.createWatchIntake(
        intakeData(readBody(req.body)),
      );
      res.status(201).json(intake);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/watch-intakes", async (_req, res) => {
    res.json(await repository.listWatchIntakes());
  });

  router.get("/watch-intakes/:id", async (req, res) => {
    try {
      const intake = await repository.getWatchIntake(req.params.id);
      if (!intake) throw new HttpError(404, "Watch intake not found.");
      res.json(intake);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
