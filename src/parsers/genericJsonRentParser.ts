import type { ParsedPriceItem } from "./priceParser.js";

const RENT_KEYS = new Set([
  "rent",
  "price",
  "marketrent",
  "minrent",
  "maxrent",
  "baserent",
]);

function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

function numberFromValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\$?\s*([1-9]\d{2,4}(?:,\d{3})?)/);
  if (!match?.[1]) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findByKeys(object: Record<string, unknown>, keys: string[]): unknown {
  for (const [key, value] of Object.entries(object)) {
    if (keys.includes(normalizeKey(key))) return value;
  }
  return undefined;
}

function hasContextKey(object: Record<string, unknown>): boolean {
  return Object.keys(object).some((key) =>
    [
      "floorplan",
      "floorplanname",
      "unit",
      "unitnumber",
      "beds",
      "bedrooms",
      "baths",
      "bathrooms",
      "sqft",
      "squarefeet",
      "available",
      "availability",
      "moveindate",
      "special",
      "concession",
    ].includes(normalizeKey(key)),
  );
}

function parseObject(object: Record<string, unknown>): ParsedPriceItem | null {
  let rent: number | undefined;
  for (const [key, value] of Object.entries(object)) {
    if (RENT_KEYS.has(normalizeKey(key))) {
      rent = numberFromValue(value);
      if (rent !== undefined) break;
    }
  }
  if (rent === undefined || rent < 500 || rent > 20_000) return null;
  if (!hasContextKey(object) && Object.keys(object).length < 2) return null;

  const bedrooms = numberFromValue(findByKeys(object, ["beds", "bedrooms"]));
  const bathrooms = numberFromValue(findByKeys(object, ["baths", "bathrooms"]));
  const sqft = numberFromValue(findByKeys(object, ["sqft", "squarefeet"]));
  const floorplanName = stringFromValue(
    findByKeys(object, ["floorplan", "floorplanname"]),
  );
  const unitNumber = stringFromValue(
    findByKeys(object, ["unit", "unitnumber"]),
  );
  const availabilityValue = findByKeys(object, ["available", "availability"]);
  const availabilityStatus =
    typeof availabilityValue === "boolean"
      ? availabilityValue
        ? "AVAILABLE"
        : "UNAVAILABLE"
      : stringFromValue(availabilityValue);
  const specialOfferText = stringFromValue(
    findByKeys(object, ["special", "concession"]),
  );
  const moveInDate = stringFromValue(findByKeys(object, ["moveindate"]));

  return {
    baseRent: Math.round(rent),
    bedrooms: bedrooms === undefined ? undefined : Math.round(bedrooms),
    bathrooms,
    sqft: sqft === undefined ? undefined : Math.round(sqft),
    floorplanName,
    unitNumber,
    availabilityStatus,
    specialOfferText,
    moveInDate,
    rawData: object,
  };
}

function visit(value: unknown, results: ParsedPriceItem[]): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, results);
    return;
  }
  if (!value || typeof value !== "object") return;

  const object = value as Record<string, unknown>;
  const parsed = parseObject(object);
  if (parsed) results.push(parsed);
  for (const nested of Object.values(object)) visit(nested, results);
}

export function parseGenericJsonRent(input: unknown): ParsedPriceItem[] {
  const results: ParsedPriceItem[] = [];
  visit(input, results);
  return results;
}
