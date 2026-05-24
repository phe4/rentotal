import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";

export type BrowserCollectedPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  contentHash: string;
  rendered: true;
  jsonCandidates?: JsonEndpointCandidate[];
};

export type JsonEndpointCandidate = {
  url: string;
  method: "GET";
  contentType?: string;
  confidence: number;
  reason: string;
  discoveredAt: string;
  sample?: unknown;
};

export type BrowserCollector = (
  url: string,
  options?: { timeoutMs?: number },
) => Promise<BrowserCollectedPage>;

const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);
const BLOCKED_HOST_PATTERNS = [
  "googletagmanager",
  "google-analytics",
  "doubleclick",
  "facebook.net",
  "hotjar",
  "segment",
];
const JSON_BODY_LIMIT = 200_000;
const CANDIDATE_SIGNALS = [
  "rent",
  "price",
  "pricing",
  "floorplan",
  "floorPlan",
  "unit",
  "apartment",
  "availability",
  "available",
  "beds",
  "baths",
  "sqft",
  "concession",
  "special",
  "lease",
];
const EXCLUDED_URL_SIGNALS = [
  "analytics",
  "tracking",
  "doubleclick",
  "googletagmanager",
  "google-analytics",
  "facebook",
  "hotjar",
  "segment",
  "ads",
  "map",
  "auth",
  "session",
  "user",
];

function looksSensitive(key: string): boolean {
  return /token|cookie|password|secret|session|auth|authorization|api[-_]?key|access[-_]?key/i.test(
    key,
  );
}

function stripSensitive(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (Array.isArray(value))
    return value.slice(0, 5).map((item) => stripSensitive(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !looksSensitive(key))
      .slice(0, 25)
      .map(([key, item]) => [key, stripSensitive(item, depth + 1)]),
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

export function detectJsonEndpointCandidate(input: {
  url: string;
  contentType?: string;
  json: unknown;
}): JsonEndpointCandidate | null {
  const lowerUrl = input.url.toLowerCase();
  if (EXCLUDED_URL_SIGNALS.some((signal) => lowerUrl.includes(signal)))
    return null;
  const keyText = flattenKeys(input.json).join(" ").toLowerCase();
  const urlScore = CANDIDATE_SIGNALS.filter((signal) =>
    lowerUrl.includes(signal.toLowerCase()),
  ).length;
  const keyScore = CANDIDATE_SIGNALS.filter((signal) =>
    keyText.includes(signal.toLowerCase()),
  ).length;
  if (urlScore + keyScore < 2) return null;
  const confidence = Math.min(0.95, 0.45 + urlScore * 0.1 + keyScore * 0.08);
  if (confidence < 0.6) return null;
  return {
    url: input.url,
    method: "GET",
    contentType: input.contentType,
    confidence: Math.round(confidence * 100) / 100,
    reason: "JSON response contained rent and floorplan-like keys",
    discoveredAt: new Date().toISOString(),
    sample: stripSensitive(input.json),
  };
}

export const collectBrowserPage: BrowserCollector = async (
  url,
  options = {},
) => {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const jsonCandidates: JsonEndpointCandidate[] = [];

  try {
    context = await browser.newContext();
    page = await context.newPage();
    page.on("response", (response) => {
      void (async () => {
        const contentType = response.headers()["content-type"];
        const url = response.url();
        if (
          !contentType?.includes("application/json") &&
          !url.toLowerCase().includes("json")
        ) {
          return;
        }
        const text = await response.text().catch(() => "");
        if (!text || text.length > JSON_BODY_LIMIT) return;
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return;
        }
        const candidate = detectJsonEndpointCandidate({
          url,
          contentType,
          json,
        });
        if (
          candidate &&
          !jsonCandidates.some((item) => item.url === candidate.url)
        ) {
          jsonCandidates.push(candidate);
        }
      })();
    });

    await page.route("**/*", async (route) => {
      const request = route.request();
      const requestUrl = request.url().toLowerCase();
      if (
        BLOCKED_RESOURCE_TYPES.has(request.resourceType()) ||
        BLOCKED_HOST_PATTERNS.some((pattern) => requestUrl.includes(pattern))
      ) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: timeoutMs });
    } catch {
      // DOM content is enough for the fallback parser; network idle is best-effort.
    }

    const text = await page.locator("body").innerText({ timeout: timeoutMs });
    const contentHash = createHash("sha256").update(text).digest("hex");
    const finalUrl = page.url() || url;

    return {
      url: finalUrl,
      statusCode: response?.status(),
      contentType: response?.headers()["content-type"],
      text,
      contentHash,
      rendered: true,
      jsonCandidates,
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser.close();
  }
};
