import type {
  DomainPriceParser,
  ParsedPriceItem,
  ParserResult,
} from "./priceParser.js";
import {
  detectPlatform,
  isKnockCommunityUrl,
  isKnockUnitsUrl,
} from "./platformDetector.js";

const RENT_KEYS = [
  "rent",
  "price",
  "marketRent",
  "market_rent",
  "minRent",
  "min_rent",
  "maxRent",
  "max_rent",
  "baseRent",
  "base_rent",
];

export const knockDoorwayParser: DomainPriceParser = {
  name: "knock-doorway-parser",
  version: "1.0.0",
  priority: 100,
  canParse(input) {
    return (
      detectPlatform({ url: input.url, json: input.json }) === "KNOCK_DOORWAY"
    );
  },
  parse(input): ParserResult {
    const url = input.url ?? input.context?.url;
    const endpointType = url
      ? isKnockUnitsUrl(url)
        ? "units"
        : isKnockCommunityUrl(url)
          ? "community"
          : "unknown"
      : "unknown";
    const items = parseKnockItems(input.json);
    const confidence =
      items.length === 0
        ? endpointType === "units"
          ? 0.45
          : 0.25
        : endpointType === "units"
          ? 0.95
          : 0.7;
    return {
      parserName: knockDoorwayParser.name,
      parserVersion: knockDoorwayParser.version,
      confidence,
      items,
      metadata: { platform: "KNOCK_DOORWAY", endpointType },
    };
  },
};

function parseKnockItems(json: unknown): ParsedPriceItem[] {
  const results: ParsedPriceItem[] = [];
  visit(json, results);
  return results;
}

function visit(value: unknown, results: ParsedPriceItem[]): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, results);
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  const item = parseUnitLikeObject(object);
  if (item) results.push(item);
  for (const nested of Object.values(object)) visit(nested, results);
}

function parseUnitLikeObject(
  object: Record<string, unknown>,
): ParsedPriceItem | null {
  const baseRent = firstNumber(object, RENT_KEYS);
  if (baseRent === undefined || baseRent < 500 || baseRent > 20_000) {
    return null;
  }
  if (!hasUnitContext(object)) return null;

  const item: ParsedPriceItem = {
    floorplanName: firstString(object, [
      "floorplanName",
      "floorPlanName",
      "floorplan",
      "floor_plan_name",
      "modelName",
    ]),
    unitNumber: firstString(object, [
      "unitNumber",
      "unit",
      "unit_name",
      "name",
    ]),
    bedrooms: rounded(firstNumber(object, ["bedrooms", "beds", "bed"])),
    bathrooms: firstNumber(object, ["bathrooms", "baths", "bath"]),
    sqft: rounded(firstNumber(object, ["sqft", "squareFeet", "area"])),
    baseRent: Math.round(baseRent),
    effectiveRent: firstNumber(object, ["effectiveRent", "effective_rent"]),
    leaseTermMonths: rounded(
      firstNumber(object, ["leaseTermMonths", "lease_term_months"]),
    ),
    moveInDate: firstString(object, [
      "moveInDate",
      "availableDate",
      "available_date",
    ]),
    specialOfferText: firstString(object, [
      "specialOfferText",
      "special",
      "concession",
    ]),
    specialOfferValue: firstNumber(object, [
      "specialOfferValue",
      "concessionValue",
    ]),
    availabilityStatus: availabilityStatus(object),
    rawData: object,
  };
  return item;
}

function hasUnitContext(object: Record<string, unknown>): boolean {
  return [
    "unit",
    "unitnumber",
    "unitname",
    "floorplan",
    "floorplanname",
    "floor_plan_name",
    "bedrooms",
    "beds",
    "bathrooms",
    "baths",
    "sqft",
    "squarefeet",
    "available",
    "availability",
  ].some((key) => normalizedKeys(object).has(key));
}

function normalizedKeys(object: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(object).map(normalizeKey));
}

function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

function firstNumber(
  object: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = findValue(object, key);
    const parsed = numberFromValue(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function firstString(
  object: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = findValue(object, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function findValue(object: Record<string, unknown>, key: string): unknown {
  const target = normalizeKey(key);
  for (const [candidate, value] of Object.entries(object)) {
    if (normalizeKey(candidate) === target) return value;
  }
  return undefined;
}

function numberFromValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\$?\s*([1-9]\d{2,4}(?:,\d{3})?)/);
  if (!match?.[1]) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function rounded(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

function availabilityStatus(
  object: Record<string, unknown>,
): string | undefined {
  const value =
    findValue(object, "availability") ?? findValue(object, "available");
  if (typeof value === "boolean") return value ? "AVAILABLE" : "UNAVAILABLE";
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}
