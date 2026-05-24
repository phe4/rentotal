import { createHash } from "node:crypto";

export type CollectedPage = {
  url: string;
  statusCode?: number;
  contentType?: string;
  text: string;
  contentHash: string;
};

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export async function collectHttpPage(
  url: string,
  fetcher: FetchLike = globalThis.fetch as FetchLike,
): Promise<CollectedPage> {
  const response = await fetcher(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      "user-agent": "RentotalBot/0.1 (+https://example.local)",
    },
  });
  const text = await response.text();
  const contentHash = createHash("sha256").update(text).digest("hex");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    url,
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? undefined,
    text,
    contentHash,
  };
}
