export type Platform = "KNOCK_DOORWAY" | "UNKNOWN";

export function detectPlatform(input: {
  url?: string;
  json?: unknown;
}): Platform {
  if (input.url) {
    return isKnockDoorwayUrl(input.url) ? "KNOCK_DOORWAY" : "UNKNOWN";
  }
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

function hasKnockLikeJson(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const keys = flattenKeys(value).join(" ").toLowerCase();
  return (
    keys.includes("floorplan") &&
    keys.includes("unit") &&
    (keys.includes("rent") || keys.includes("price"))
  );
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
