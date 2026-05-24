import { Router } from "express";
import {
  intakeInputTypes,
  type IntakeInputType,
  type Repository,
} from "../types.js";
import { HttpError, sendError } from "../validation/http.js";
import {
  isUrlInputType,
  optionalString,
  optionalUrl,
} from "../validation/index.js";
import {
  ensureWatchList,
  inferSourceType,
  readBody,
  validateIntakeUrl,
  watchItemFields,
  watchItemPatchFields,
} from "./helpers.js";

export function watchItemsRouter(repository: Repository): Router {
  const router = Router();

  router.post("/watch-items", async (req, res) => {
    try {
      const body = readBody(req.body);
      const watchList = await ensureWatchList(repository, body.watchListId);
      let propertyId = optionalString(body, "propertyId") ?? null;
      let inputType = body.inputType as IntakeInputType | undefined;
      let inputValue = body.inputValue;
      const rawSourceUrl = optionalString(body, "sourceUrl");
      const explicitSourceUrl = optionalUrl(body, "sourceUrl");
      let sourceUrl = explicitSourceUrl;

      if (!propertyId) {
        const name = optionalString(body, "name");
        const address = optionalString(body, "address");
        if (!inputType)
          inputType = sourceUrl
            ? "OFFICIAL_WEBSITE_URL"
            : name
              ? "PROPERTY_NAME"
              : "FREE_TEXT";
        if (!inputValue)
          inputValue =
            rawSourceUrl ?? name ?? address ?? optionalString(body, "notes");

        if (
          !inputValue ||
          typeof inputValue !== "string" ||
          inputValue.trim().length === 0
        ) {
          throw new HttpError(
            400,
            "propertyId, name, address, sourceUrl, or inputValue is required.",
          );
        }

        if (!intakeInputTypes.includes(inputType)) {
          throw new HttpError(
            400,
            `inputType must be one of: ${intakeInputTypes.join(", ")}.`,
          );
        }
        validateIntakeUrl(inputType, inputValue);
        sourceUrl =
          explicitSourceUrl ?? sourceUrlFromUrlLikeInput(inputType, inputValue);
        const propertyName =
          name ??
          (sourceUrl ? new URL(sourceUrl).hostname : (address ?? inputValue));
        const property = await repository.createProperty({
          name: propertyName,
          address: address ?? null,
          officialWebsite: sourceUrl ?? null,
        });
        propertyId = property.id;

        if (sourceUrl) {
          await repository.createPropertySource({
            propertyId,
            sourceType: inferSourceType(inputType),
            sourceUrl,
            sourceExternalId: null,
            isPrimary: true,
            metadata: { intakeValue: inputValue },
          });
        }
      } else {
        const property = await repository.getProperty(propertyId);
        if (!property) throw new HttpError(404, "Property not found.");
        if (!inputType)
          inputType = sourceUrl ? "OFFICIAL_WEBSITE_URL" : "PROPERTY_NAME";
        if (!inputValue) inputValue = rawSourceUrl ?? property.name;
        if (typeof inputValue !== "string" || inputValue.trim().length === 0) {
          throw new HttpError(400, "inputValue must be a non-empty string.");
        }
        if (!intakeInputTypes.includes(inputType)) {
          throw new HttpError(
            400,
            `inputType must be one of: ${intakeInputTypes.join(", ")}.`,
          );
        }
        validateIntakeUrl(inputType, inputValue);
        sourceUrl =
          explicitSourceUrl ?? sourceUrlFromUrlLikeInput(inputType, inputValue);

        if (sourceUrl) {
          await repository.createPropertySource({
            propertyId,
            sourceType: inferSourceType(inputType),
            sourceUrl,
            sourceExternalId: null,
            isPrimary: false,
            metadata: { intakeValue: inputValue },
          });
        }
      }

      await repository.createWatchIntake({
        inputType,
        inputValue,
        parsedStatus: "PARSED",
        matchedPropertyId: propertyId,
        errorMessage: null,
      });

      const watchItem = await repository.createWatchListItem({
        watchListId: watchList.id,
        propertyId,
        ...watchItemFields(body),
      });
      res.status(201).json(watchItem);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/watch-items", async (_req, res) => {
    res.json(await repository.listWatchListItems());
  });

  router.get("/watch-items/:id", async (req, res) => {
    const item = await repository.getWatchListItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Watch item not found." });
    res.json(item);
  });

  router.patch("/watch-items/:id", async (req, res) => {
    try {
      const item = await repository.updateWatchListItem(
        req.params.id,
        watchItemPatchFields(readBody(req.body)),
      );
      if (!item) throw new HttpError(404, "Watch item not found.");
      res.json(item);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete("/watch-items/:id", async (req, res) => {
    const deleted = await repository.deleteWatchListItem(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Watch item not found." });
    res.status(204).send();
  });

  return router;
}

function sourceUrlFromUrlLikeInput(
  inputType: IntakeInputType,
  inputValue: unknown,
): string | null {
  if (!isUrlInputType(inputType) || typeof inputValue !== "string") return null;
  const url = new URL(inputValue);
  return url.toString();
}
