import { Router } from "express";
import {
  priceCheckRunStatuses,
  type PriceCheckRunStatus,
  type Repository,
} from "../types.js";
import {
  ScheduledPriceCheckService,
  type RunAllOptions,
  type ScheduledPriceCheckServiceOptions,
} from "../services/scheduledPriceCheckService.js";
import { HttpError, sendError } from "../validation/http.js";

export function priceCheckRouter(
  repository: Repository,
  options: ScheduledPriceCheckServiceOptions = {},
): Router {
  const router = Router();
  const service = new ScheduledPriceCheckService(repository, options);

  router.post("/price-check/run-all", async (req, res) => {
    try {
      res.json(await service.runAll(parseRunAllOptions(req.body)));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/price-check/runs", async (req, res) => {
    try {
      res.json(
        await service.listRuns({
          limit: parseLimit(req.query.limit),
          status: parseStatus(req.query.status),
        }),
      );
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/price-check/runs/:id", async (req, res) => {
    try {
      const detail = await service.getRun(req.params.id);
      if (!detail) throw new HttpError(404, "Price check run not found.");
      res.json(detail);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/price-check/health", async (_req, res) => {
    try {
      res.json(await service.getHealth());
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}

function parseLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "Invalid limit.");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, "Invalid limit.");
  }
  return parsed;
}

function parseStatus(value: unknown): PriceCheckRunStatus | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !priceCheckRunStatuses.includes(value as PriceCheckRunStatus)
  ) {
    throw new HttpError(400, "Invalid status.");
  }
  return value as PriceCheckRunStatus;
}

function parseRunAllOptions(body: unknown): RunAllOptions {
  if (body === undefined || body === null) return {};
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object.");
  }
  const input = body as Record<string, unknown>;
  return {
    dryRun: parseOptionalBoolean(input.dryRun, "dryRun"),
    cooldownMinutes: parseOptionalPositiveNumber(
      input.cooldownMinutes,
      "cooldownMinutes",
    ),
    force: parseOptionalBoolean(input.force, "force"),
    maxSources: parseOptionalPositiveInteger(input.maxSources, "maxSources"),
  };
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${field} must be a boolean.`);
  }
  return value;
}

function parseOptionalPositiveNumber(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${field} must be a non-negative number.`);
  }
  return value;
}

function parseOptionalPositiveInteger(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new HttpError(400, `${field} must be a positive integer.`);
  }
  return value as number;
}
