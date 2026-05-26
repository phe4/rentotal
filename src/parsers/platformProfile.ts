import type { ParsedPriceItem } from "./priceParser.js";
import { parseJsonOrJsonp } from "./jsonpUtils.js";

export type PlatformProfileStatus = "DRAFT" | "APPROVED" | "DISABLED";
export type PlatformProfileResponseFormat = "json" | "jsonp";
export type FieldMapping = string | string[];

export type PlatformProfile = {
  platform: string;
  version: string;
  status: PlatformProfileStatus;
  match: {
    urlIncludes?: string[];
    query?: Record<string, string>;
  };
  response: {
    format: PlatformProfileResponseFormat;
    arrayPath: string;
  };
  mapping: Partial<Record<keyof ParsedPriceItem, FieldMapping>>;
  rawData?: {
    preserve?: string[];
  };
  rules: {
    requiredFields: Array<keyof ParsedPriceItem>;
    numericFields?: Array<keyof ParsedPriceItem>;
    minBaseRent?: number;
    maxBaseRent?: number;
    doNotUseAsBaseRent?: string[];
  };
  endpointPromotion?: {
    canPromote: boolean;
    stripQueryParams?: string[];
    requiredParseableItems?: number;
  };
};

const SENSITIVE_KEY_PATTERN =
  /token|cookie|password|secret|session|auth|authorization|api[-_]?key|access[-_]?key|resident|user/i;

export function profileMatchesUrl(
  profile: PlatformProfile,
  url: string | undefined,
): boolean {
  if (profile.status !== "APPROVED" || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const lowerUrl = url.toLowerCase();
  const includes = profile.match.urlIncludes ?? [];
  if (
    includes.length > 0 &&
    !includes.every((part) => lowerUrl.includes(part.toLowerCase()))
  ) {
    return false;
  }
  for (const [key, expected] of Object.entries(profile.match.query ?? {})) {
    if (
      parsed.searchParams.get(key)?.toLowerCase() !== expected.toLowerCase()
    ) {
      return false;
    }
  }
  return true;
}

export function parseWithPlatformProfile(input: {
  profile: PlatformProfile;
  url?: string;
  text?: string;
  json?: unknown;
  includeDraftProfiles?: boolean;
}): ParsedPriceItem[] {
  if (
    input.profile.status === "DISABLED" ||
    (input.profile.status === "DRAFT" && !input.includeDraftProfiles)
  ) {
    return [];
  }
  const parsed = responseData(input.profile, input);
  const rows = valueAtPath(parsed, input.profile.response.arrayPath);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? mapRow(input.profile, row as Record<string, unknown>)
        : null,
    )
    .filter((item): item is ParsedPriceItem => item !== null);
}

export function normalizeEndpointForProfile(
  profile: PlatformProfile,
  url: string,
): string {
  try {
    const parsed = new URL(url);
    for (const param of profile.endpointPromotion?.stripQueryParams ?? []) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function profileEndpointCanPromote(input: {
  profile: PlatformProfile;
  url?: string;
  text?: string;
  json?: unknown;
}): boolean {
  const requiredItems = input.profile.endpointPromotion?.requiredParseableItems;
  if (
    !input.profile.endpointPromotion?.canPromote ||
    requiredItems === undefined
  ) {
    return false;
  }
  return parseWithPlatformProfile(input).length >= requiredItems;
}

function responseData(
  profile: PlatformProfile,
  input: { text?: string; json?: unknown },
): unknown {
  if (input.json !== undefined) return input.json;
  if (!input.text) return undefined;
  if (profile.response.format === "json") {
    try {
      return JSON.parse(input.text);
    } catch {
      return undefined;
    }
  }
  return parseJsonOrJsonp(input.text) ?? undefined;
}

function mapRow(
  profile: PlatformProfile,
  row: Record<string, unknown>,
): ParsedPriceItem | null {
  const item: ParsedPriceItem = {};
  for (const [target, mapping] of Object.entries(profile.mapping) as Array<
    [keyof ParsedPriceItem, FieldMapping]
  >) {
    if (target === "baseRent" && disallowedBaseRentMapping(profile, mapping)) {
      continue;
    }
    const value = firstMappedValue(row, mapping);
    if (value === undefined || value === null || value === "") continue;
    item[target] = normalizeMappedValue(profile, target, value) as never;
  }

  if (!requiredFieldsPresent(profile, item)) return null;
  if (!baseRentInRange(profile, item.baseRent)) return null;

  item.rawData = preservedRawData(profile, row);
  return item;
}

function firstMappedValue(
  row: Record<string, unknown>,
  mapping: FieldMapping,
): unknown {
  const paths = Array.isArray(mapping) ? mapping : [mapping];
  for (const path of paths) {
    const value = valueAtPath(row, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function disallowedBaseRentMapping(
  profile: PlatformProfile,
  mapping: FieldMapping,
): boolean {
  const paths = Array.isArray(mapping) ? mapping : [mapping];
  const blocked = new Set(
    [
      ...(profile.rules.doNotUseAsBaseRent ?? []),
      "phone",
      "phoneNumber",
      "id",
      "unitId",
      "propertyId",
      "partnerPropertyId",
      "sqft",
      "squareFeet",
      "leaseTerm",
      "leaseTermMonths",
      "minLeaseTermInMonth",
      "maxLeaseTermInMonth",
      "fee",
      "fees",
      "deposit",
      "deposits",
      "mandatoryFees",
      "mandatoryFeesDeposits",
    ].map(normalizePath),
  );
  return paths.some((path) => blocked.has(normalizePath(path)));
}

function normalizeMappedValue(
  profile: PlatformProfile,
  target: keyof ParsedPriceItem,
  value: unknown,
): unknown {
  if (profile.rules.numericFields?.includes(target)) {
    const parsed = numberFromValue(value);
    if (parsed === undefined) return undefined;
    return [
      "baseRent",
      "bedrooms",
      "sqft",
      "leaseTermMonths",
      "mandatoryFees",
    ].includes(target)
      ? Math.round(parsed)
      : parsed;
  }
  return typeof value === "string" ? value.trim() : value;
}

function requiredFieldsPresent(
  profile: PlatformProfile,
  item: ParsedPriceItem,
): boolean {
  return profile.rules.requiredFields.every((field) => {
    const value = item[field];
    return value !== undefined && value !== null && value !== "";
  });
}

function baseRentInRange(
  profile: PlatformProfile,
  baseRent: number | undefined,
): boolean {
  if (baseRent === undefined) return true;
  const min = profile.rules.minBaseRent ?? 0;
  const max = profile.rules.maxBaseRent ?? Number.MAX_SAFE_INTEGER;
  return baseRent >= min && baseRent <= max;
}

function preservedRawData(
  profile: PlatformProfile,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const preserve = profile.rawData?.preserve ?? [];
  return Object.fromEntries(
    preserve
      .filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
      .map((key) => [key, sanitizePreservedValue(valueAtPath(row, key))])
      .filter(([, value]) => value !== undefined),
  );
}

function sanitizePreservedValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) => sanitizePreservedValue(item, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, item]) => [key, sanitizePreservedValue(item, depth + 1)]),
  );
}

export function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);
}

export function numberFromValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePath(path: string): string {
  return path.replace(/[_\-\s.]/g, "").toLowerCase();
}
