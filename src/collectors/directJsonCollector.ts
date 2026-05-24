import { createHash } from "node:crypto";
import type { FetchLike } from "./httpCollector.js";

export type DirectJsonEndpoint = {
  url: string;
  method?: string;
  contentType?: string;
};

export type DirectJsonPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  json: unknown;
  contentHash: string;
};

export type DirectJsonCollector = (
  endpoint: DirectJsonEndpoint,
) => Promise<DirectJsonPage>;

export function createDirectJsonCollector(
  fetcher?: FetchLike,
): DirectJsonCollector {
  return async (endpoint) => {
    const method = endpoint.method ?? "GET";
    if (method !== "GET") {
      throw new Error("Only GET direct JSON endpoints are supported.");
    }
    const response = await (fetcher ?? (globalThis.fetch as FetchLike))(
      endpoint.url,
      {
        headers: {
          accept: "application/json,text/plain;q=0.8,*/*;q=0.5",
          "user-agent": "RentotalBot/0.1 (+https://example.local)",
        },
      },
    );
    const text = await response.text();
    const contentHash = createHash("sha256").update(text).digest("hex");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Direct JSON endpoint did not return valid JSON.");
    }

    return {
      url: endpoint.url,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? endpoint.contentType,
      text,
      json,
      contentHash,
    };
  };
}
