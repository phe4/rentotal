import type {
  OverviewResponse,
  PriceCheckHealth,
  PriceCheckRun,
  RunAllOptions,
  WatchItemDetail,
} from "./types";

type ErrorPayload = {
  error?: string;
  message?: string;
};

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://localhost:3000";
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

const API_BASE_URL = resolveApiBaseUrl();

async function parseErrorMessage(response: Response): Promise<string> {
  let detail = "";
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ErrorPayload;
      detail = payload.error ?? payload.message ?? "";
    } else {
      detail = (await response.text()).trim();
    }
  } catch {
    // Ignore payload parse failures and fall back to status text.
  }

  return detail || response.statusText || `HTTP ${response.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const dashboardApi = {
  getHealth(): Promise<PriceCheckHealth> {
    return requestJson("/api/price-check/health");
  },

  getRuns(limit = 10): Promise<PriceCheckRun[]> {
    return requestJson(`/api/price-check/runs?limit=${limit}`);
  },

  getTrackingOverview(limit = 50, offset = 0): Promise<OverviewResponse> {
    return requestJson(
      `/api/watch-items/tracking-summary?limit=${limit}&offset=${offset}`,
    );
  },

  getWatchItemDetail(watchItemId: string): Promise<WatchItemDetail> {
    return requestJson(`/api/watch-items/${watchItemId}/tracking-summary`);
  },

  runPriceCheck(options: RunAllOptions): Promise<unknown> {
    return requestJson("/api/price-check/run-all", {
      method: "POST",
      body: JSON.stringify(options),
    });
  },
};
