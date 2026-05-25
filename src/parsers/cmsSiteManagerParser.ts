import type {
  DomainPriceParser,
  ParsedPriceItem,
  ParserResult,
} from "./priceParser.js";
import {
  detectPlatform,
  isCmsSiteManagerGetUnitsUrl,
} from "./platformDetector.js";

export const cmsSiteManagerParser: DomainPriceParser = {
  name: "cmssitemanager-parser",
  version: "1.0.0",
  priority: 80,
  canParse(input) {
    return (
      detectPlatform({ url: input.url, json: input.json }) === "CMSSITEMANAGER"
    );
  },
  parse(input): ParserResult {
    const url = input.url ?? input.context?.url;
    const endpointType =
      url && isCmsSiteManagerGetUnitsUrl(url) ? "proxy-get-units" : "unknown";
    const items = parseCmsSiteManagerUnits(input.json);
    return {
      parserName: cmsSiteManagerParser.name,
      parserVersion: cmsSiteManagerParser.version,
      confidence:
        items.length > 0
          ? endpointType === "proxy-get-units"
            ? 0.94
            : 0.82
          : endpointType === "proxy-get-units"
            ? 0.4
            : 0.2,
      items,
      metadata: { platform: "CMSSITEMANAGER", endpointType },
    };
  },
};

export function parseCmsSiteManagerUnits(input: unknown): ParsedPriceItem[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const units = (input as Record<string, unknown>).units;
  if (!Array.isArray(units)) return [];
  return units
    .map((unit) =>
      unit && typeof unit === "object" && !Array.isArray(unit)
        ? parseUnit(unit as Record<string, unknown>)
        : null,
    )
    .filter((item): item is ParsedPriceItem => item !== null);
}

function parseUnit(unit: Record<string, unknown>): ParsedPriceItem | null {
  const baseRent = numberFromValue(unit.rent);
  if (baseRent === undefined || baseRent < 500 || baseRent > 20_000) {
    return null;
  }

  return {
    floorplanName: stringFromValue(unit.floorplanName),
    unitNumber: stringFromValue(unit.unitNumber) ?? stringFromValue(unit.name),
    bedrooms: integerFromValue(unit.numberOfBeds),
    bathrooms: numberFromValue(unit.numberOfBaths),
    sqft: integerFromValue(unit.squareFeet),
    baseRent: Math.round(baseRent),
    leaseTermMonths: integerFromValue(unit.minLeaseTermInMonth),
    moveInDate: stringFromValue(unit.internalAvailableDate),
    mandatoryFees: integerFromValue(unit.mandatoryFeesDeposits),
    availabilityStatus:
      stringFromValue(unit.unitLeasedStatus) ??
      stringFromValue(unit.leaseStatus),
    rawData: sanitizeUnit(unit),
  };
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberFromValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerFromValue(value: unknown): number | undefined {
  const parsed = numberFromValue(value);
  return parsed === undefined ? undefined : Math.round(parsed);
}

function sanitizeUnit(unit: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(unit)
      .filter(
        ([key]) =>
          !/token|cookie|password|secret|session|auth|authorization|api[-_]?key|access[-_]?key/i.test(
            key,
          ),
      )
      .slice(0, 40),
  );
}
