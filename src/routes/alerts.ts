import { Router } from "express";
import type { Repository } from "../types.js";
import { HttpError, sendError } from "../validation/http.js";

export function alertsRouter(repository: Repository): Router {
  const router = Router();

  router.get("/alerts", async (_req, res) => {
    res.json(await repository.listAlerts());
  });

  router.patch("/alerts/:id/read", async (req, res) => {
    try {
      const alert = await repository.markAlertRead(req.params.id);
      if (!alert) throw new HttpError(404, "Alert not found.");
      res.json(alert);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
