import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";

export type BrowserCollectedPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  contentHash: string;
  rendered: true;
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

export const collectBrowserPage: BrowserCollector = async (
  url,
  options = {},
) => {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext();
    page = await context.newPage();

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
    };
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser.close();
  }
};
