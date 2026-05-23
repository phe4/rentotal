import type { Repository } from "../types.js";
import {
  bodyObject,
  enumValue,
  optionalDate,
  optionalEnum,
  optionalNumber,
  optionalString,
  optionalUrl,
  requiredString,
} from "../validation/index.js";
import { HttpError } from "../validation/http.js";
import {
  intakeInputTypes,
  parsedStatuses,
  sourceTypes,
  watchPriorities,
  watchStatuses,
  type IntakeInputType,
  type SourceType,
} from "../types.js";

export function propertyData(
  body: Record<string, unknown>,
  requireName = true,
) {
  const name = requireName
    ? requiredString(body, "name")
    : optionalString(body, "name");
  return {
    ...(name !== undefined && name !== null ? { name } : {}),
    address: optionalString(body, "address"),
    city: optionalString(body, "city"),
    state: optionalString(body, "state"),
    zip: optionalString(body, "zip"),
    lat: optionalNumber(body, "lat"),
    lng: optionalNumber(body, "lng"),
    officialWebsite: optionalUrl(body, "officialWebsite"),
    propertyType: optionalString(body, "propertyType"),
  };
}

export function sourceData(body: Record<string, unknown>, propertyId: string) {
  return {
    propertyId,
    sourceType: enumValue(body, "sourceType", sourceTypes, "MANUAL"),
    sourceUrl: optionalUrl(body, "sourceUrl") ?? null,
    sourceExternalId: optionalString(body, "sourceExternalId") ?? null,
    isPrimary: typeof body.isPrimary === "boolean" ? body.isPrimary : false,
    metadata:
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : null,
  };
}

export function intakeData(
  body: Record<string, unknown>,
  matchedPropertyId?: string | null,
) {
  const inputType = enumValue(body, "inputType", intakeInputTypes);
  const inputValue = requiredString(body, "inputValue");
  validateIntakeUrl(inputType, inputValue);
  return {
    inputType,
    inputValue,
    parsedStatus: enumValue(body, "parsedStatus", parsedStatuses, "PENDING"),
    matchedPropertyId:
      matchedPropertyId ?? optionalString(body, "matchedPropertyId") ?? null,
    errorMessage: optionalString(body, "errorMessage") ?? null,
  };
}

export function validateIntakeUrl(
  inputType: IntakeInputType,
  inputValue: string,
): void {
  if (!inputType.endsWith("_URL") && inputType !== "OFFICIAL_WEBSITE_URL")
    return;
  try {
    const url = new URL(inputValue);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Unsupported protocol");
  } catch {
    throw new HttpError(
      400,
      "inputValue must be a valid HTTP(S) URL for URL input types.",
    );
  }
}

export function inferSourceType(inputType: IntakeInputType): SourceType {
  switch (inputType) {
    case "OFFICIAL_WEBSITE_URL":
      return "OFFICIAL_SITE";
    case "FLOORPLAN_URL":
      return "FLOORPLAN_URL";
    case "ZILLOW_URL":
      return "ZILLOW";
    case "APARTMENTS_COM_URL":
      return "APARTMENTS_COM";
    case "GOOGLE_MAPS_URL":
      return "GOOGLE_MAPS";
    default:
      return "MANUAL";
  }
}

export async function ensureWatchList(
  repository: Repository,
  watchListId: unknown,
) {
  if (typeof watchListId === "string" && watchListId.trim().length > 0) {
    const list = await repository.getWatchList(watchListId.trim());
    if (!list) throw new HttpError(404, "Watch list not found.");
    return list;
  }
  return repository.getOrCreateDefaultWatchList();
}

export function watchItemFields(body: Record<string, unknown>) {
  return {
    targetBedrooms: optionalNumber(body, "targetBedrooms") ?? null,
    targetBathrooms: optionalNumber(body, "targetBathrooms") ?? null,
    targetMoveInDate: optionalDate(body, "targetMoveInDate") ?? null,
    targetBudgetMin: optionalNumber(body, "targetBudgetMin") ?? null,
    targetBudgetMax: optionalNumber(body, "targetBudgetMax") ?? null,
    priority: enumValue(body, "priority", watchPriorities, "MEDIUM"),
    notes: optionalString(body, "notes") ?? null,
    status: enumValue(body, "status", watchStatuses, "WATCHING"),
  };
}

export function watchItemPatchFields(body: Record<string, unknown>) {
  return {
    targetBedrooms: optionalNumber(body, "targetBedrooms"),
    targetBathrooms: optionalNumber(body, "targetBathrooms"),
    targetMoveInDate: optionalDate(body, "targetMoveInDate"),
    targetBudgetMin: optionalNumber(body, "targetBudgetMin"),
    targetBudgetMax: optionalNumber(body, "targetBudgetMax"),
    priority: optionalEnum(body, "priority", watchPriorities),
    notes: optionalString(body, "notes"),
    status: optionalEnum(body, "status", watchStatuses),
  };
}

export function readBody(value: unknown): Record<string, unknown> {
  return bodyObject(value);
}
