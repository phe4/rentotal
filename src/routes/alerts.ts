import { Router } from "express";
import { alertTypes, type AlertType, type Repository } from "../types.js";
import { HttpError, sendError } from "../validation/http.js";

export function alertsRouter(repository: Repository): Router {
  const router = Router();

  router.get("/alerts", async (req, res) => {
    try {
      const isRead =
        req.query.isRead === undefined
          ? undefined
          : req.query.isRead === "true"
            ? true
            : req.query.isRead === "false"
              ? false
              : undefined;
      if (req.query.isRead !== undefined && isRead === undefined) {
        throw new HttpError(400, "isRead must be true or false.");
      }
      const alertType = req.query.alertType;
      if (
        alertType !== undefined &&
        (typeof alertType !== "string" ||
          !alertTypes.includes(alertType as AlertType))
      ) {
        throw new HttpError(
          400,
          `alertType must be one of: ${alertTypes.join(", ")}.`,
        );
      }
      res.json(
        await repository.listAlerts({
          isRead,
          propertyId:
            typeof req.query.propertyId === "string"
              ? req.query.propertyId
              : undefined,
          alertType: alertType as AlertType | undefined,
        }),
      );
    } catch (error) {
      sendError(res, error);
    }
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
