export type Platform = "KNOCK_DOORWAY" | "CMSSITEMANAGER" | "UNKNOWN";

export function detectPlatform(input: {
  url?: string;
  json?: unknown;
}): Platform {
  if (input.url) {
    if (isKnockDoorwayUrl(input.url)) return "KNOCK_DOORWAY";
    if (isCmsSiteManagerGetUnitsUrl(input.url)) return "CMSSITEMANAGER";
    return "UNKNOWN";
  }
  if (hasCmsSiteManagerUnitsJson(input.json)) return "CMSSITEMANAGER";
  if (hasKnockLikeJson(input.json)) return "KNOCK_DOORWAY";
  return "UNKNOWN";
}

export function isKnockDoorwayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "doorway-api.knockrentals.com" &&
      (isKnockCommunityUrl(url) || isKnockUnitsUrl(url))
    );
  } catch {
    return false;
  }
}

export function isKnockCommunityUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^\/v1\/property\/community\/[^/]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isKnockUnitsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^\/v1\/property\/[^/]+\/units\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isCmsSiteManagerGetUnitsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.toLowerCase().endsWith("/cmssitemanager/callback.aspx") &&
      parsed.searchParams.get("act")?.toLowerCase() === "proxy/getunits"
    );
  } catch {
    return false;
  }
}

export function normalizeCmsSiteManagerEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("callback");
    parsed.searchParams.delete("_");
    return parsed.toString();
  } catch {
    return url;
  }
}

function hasKnockLikeJson(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const keys = flattenKeys(value).join(" ").toLowerCase();
  return (
    keys.includes("floorplan") &&
    keys.includes("unit") &&
    (keys.includes("rent") || keys.includes("price"))
  );
}

function hasCmsSiteManagerUnitsJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const units = (value as Record<string, unknown>).units;
  if (!Array.isArray(units)) return false;
  return units.slice(0, 5).some((unit) => {
    if (!unit || typeof unit !== "object" || Array.isArray(unit)) return false;
    const keys = new Set(
      Object.keys(unit as Record<string, unknown>).map((key) =>
        key.toLowerCase(),
      ),
    );
    return (
      keys.has("rent") &&
      (keys.has("unitnumber") || keys.has("name")) &&
      (keys.has("floorplanname") || keys.has("numberofbeds"))
    );
  });
}

function flattenKeys(value: unknown, keys: string[] = [], depth = 0): string[] {
  if (depth > 5 || !value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) flattenKeys(item, keys, depth + 1);
    return keys;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    keys.push(key);
    flattenKeys(item, keys, depth + 1);
  }
  return keys;
}
