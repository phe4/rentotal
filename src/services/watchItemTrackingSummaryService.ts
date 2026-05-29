import type {
  AlertRecord,
  PriceCheckRunResultRecord,
  PriceSnapshotRecord,
  PropertyRecord,
  PropertySourceRecord,
  Repository,
  ScrapeRunRecord,
  WatchListItemRecord,
} from "../types.js";

export type WatchItemTrackingSummary = {
  watchItemId: string;
  propertyId: string;
  watchItemStatus: string;
  propertyName?: string;
  targetBudgetMax?: number | null;
  latestPrice: WatchItemLatestPrice | null;
  alertSummary: {
    unreadCount: number;
    latestAlert?: WatchItemAlertSummary | null;
  };
  trackingStatus: {
    lastCheckedAt?: string | null;
    lastSuccessfulCheckAt?: string | null;
    lastFailedCheckAt?: string | null;
    needsReview: boolean;
    lastErrorMessage?: string | null;
  };
  sourceHealth: WatchItemSourceHealth[];
  recentResults: WatchItemRecentResult[];
};

export type WatchItemLatestPrice = {
  snapshotId: string;
  sourceId?: string | null;
  floorplanName?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  baseRent?: number | null;
  effectiveRent?: number | null;
  moveInDate?: string | null;
  availabilityStatus?: string | null;
  specialOfferText?: string | null;
  scrapedAt?: string | null;
  createdAt: string;
};

export type WatchItemAlertSummary = {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export type WatchItemSourceHealth = {
  sourceId: string;
  sourceType: string;
  sourceUrl?: string | null;
  isUsable: boolean;
  lastRunStatus?: string | null;
  lastCrawlerTier?: string | null;
  lastCheckedAt?: string | null;
  itemsFound?: number | null;
  needsReview: boolean;
  errorMessage?: string | null;
};

export type WatchItemRecentResult = {
  priceCheckRunId?: string | null;
  scrapeRunId?: string | null;
  sourceId?: string | null;
  status: string;
  crawlerTier?: string | null;
  itemsFound?: number | null;
  errorMessage?: string | null;
  createdAt: string;
};

type TrackingEvent = WatchItemRecentResult & {
  id: string;
  propertyId?: string | null;
  checkedAt: Date;
};

const RECENT_RESULTS_LIMIT = 10;
const PRICE_CHECK_SOURCE_TYPES = new Set([
  "FLOORPLAN_URL",
  "OFFICIAL_SITE",
  "OTHER",
]);

export class WatchItemTrackingSummaryService {
  constructor(private repository: Repository) {}

  async getSummary(id: string): Promise<WatchItemTrackingSummary | null> {
    const watchItem = await this.repository.getWatchListItem(id);
    if (!watchItem) return null;

    const property = await this.repository.getProperty(watchItem.propertyId);
    if (!property) return null;

    const [latestPrice, alerts, sources, priceCheckResults, scrapeRuns] =
      await Promise.all([
        this.repository.getLatestPriceSnapshot(property.id),
        this.relevantAlerts(watchItem, property),
        this.repository.listPropertySources(property.id),
        this.repository.listPriceCheckRunResults(),
        this.repository.listScrapeRuns(),
      ]);
    const sourceIds = new Set(sources.map((source) => source.id));
    const events = relevantEvents(priceCheckResults, scrapeRuns, {
      propertyId: property.id,
      sourceIds,
    });

    return {
      watchItemId: watchItem.id,
      propertyId: property.id,
      watchItemStatus: watchItem.status,
      propertyName: property.name,
      targetBudgetMax: watchItem.targetBudgetMax,
      latestPrice: latestPrice ? formatLatestPrice(latestPrice) : null,
      alertSummary: {
        unreadCount: alerts.all.filter((alert) => !alert.isRead).length,
        latestAlert: alerts.latest ? formatAlert(alerts.latest) : null,
      },
      trackingStatus: trackingStatus(events),
      sourceHealth: sources.map((source) =>
        sourceHealth(source, latestEventForSource(events, source.id)),
      ),
      recentResults: events
        .slice(0, RECENT_RESULTS_LIMIT)
        .map(
          ({
            checkedAt: _checkedAt,
            id: _id,
            propertyId: _propertyId,
            ...event
          }) => event,
        ),
    };
  }

  private async relevantAlerts(
    watchItem: WatchListItemRecord,
    property: PropertyRecord,
  ): Promise<{ all: AlertRecord[]; latest: AlertRecord | null }> {
    const directAlerts = await this.repository.listAlerts({
      watchListItemId: watchItem.id,
    });
    const propertyAlerts = await this.repository.listAlerts({
      propertyId: property.id,
    });
    const byId = new Map<string, AlertRecord>();
    for (const alert of [...directAlerts, ...propertyAlerts]) {
      if (
        alert.watchListItemId === watchItem.id ||
        alert.watchListItemId === null
      ) {
        byId.set(alert.id, alert);
      }
    }
    const all = [...byId.values()].sort(compareAlertsDesc);
    const latest = directAlerts.sort(compareAlertsDesc)[0] ?? all[0] ?? null;
    return { all, latest };
  }
}

function formatLatestPrice(
  snapshot: PriceSnapshotRecord,
): WatchItemLatestPrice {
  return {
    snapshotId: snapshot.id,
    sourceId: snapshot.sourceId,
    floorplanName: snapshot.floorplanName ?? null,
    unitNumber: snapshot.unitNumber ?? null,
    bedrooms: snapshot.bedrooms ?? null,
    bathrooms: snapshot.bathrooms ?? null,
    sqft: snapshot.sqft ?? null,
    baseRent: snapshot.baseRent ?? null,
    effectiveRent: snapshot.effectiveRent ?? null,
    moveInDate: snapshot.moveInDate?.toISOString() ?? null,
    availabilityStatus: snapshot.availabilityStatus ?? null,
    specialOfferText: snapshot.specialOfferText ?? null,
    scrapedAt: snapshot.scrapedAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function formatAlert(alert: AlertRecord): WatchItemAlertSummary {
  return {
    id: alert.id,
    alertType: alert.alertType,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt.toISOString(),
    isRead: alert.isRead,
  };
}

function relevantEvents(
  priceCheckResults: PriceCheckRunResultRecord[],
  scrapeRuns: ScrapeRunRecord[],
  options: { propertyId: string; sourceIds: Set<string> },
): TrackingEvent[] {
  const priceCheckEvents = priceCheckResults
    .filter((result) => isRelevant(result, options))
    .map((result) => ({
      id: result.id,
      priceCheckRunId: result.priceCheckRunId,
      scrapeRunId: result.scrapeRunId,
      sourceId: result.sourceId,
      status: result.status,
      crawlerTier: result.crawlerTier,
      itemsFound: result.itemsFound,
      errorMessage: result.errorMessage,
      createdAt: result.createdAt.toISOString(),
      checkedAt: result.createdAt,
      propertyId: result.propertyId,
    }));
  const scrapeRunEvents = scrapeRuns
    .filter((run) => isRelevant(run, options))
    .map((run) => ({
      id: run.id,
      priceCheckRunId: null,
      scrapeRunId: run.id,
      sourceId: run.sourceId,
      status: run.status,
      crawlerTier: run.crawlerTier,
      itemsFound: run.itemsFound,
      errorMessage: run.errorMessage,
      createdAt: run.startedAt.toISOString(),
      checkedAt: run.startedAt,
      propertyId: run.propertyId,
    }));

  return [...priceCheckEvents, ...scrapeRunEvents].sort(compareEventsDesc);
}

function isRelevant(
  input: { propertyId?: string | null; sourceId?: string | null },
  options: { propertyId: string; sourceIds: Set<string> },
): boolean {
  return (
    input.propertyId === options.propertyId ||
    (input.sourceId !== null &&
      input.sourceId !== undefined &&
      options.sourceIds.has(input.sourceId))
  );
}

function trackingStatus(events: TrackingEvent[]): {
  lastCheckedAt?: string | null;
  lastSuccessfulCheckAt?: string | null;
  lastFailedCheckAt?: string | null;
  needsReview: boolean;
  lastErrorMessage?: string | null;
} {
  const latest = events[0];
  const lastSuccess = events.find((event) => event.status === "SUCCEEDED");
  const lastFailure = events.find((event) => event.status === "FAILED");
  const lastAttention = events.find(
    (event) => event.status === "FAILED" || isNeedsReviewResult(event),
  );

  return {
    lastCheckedAt: latest?.checkedAt.toISOString() ?? null,
    lastSuccessfulCheckAt: lastSuccess?.checkedAt.toISOString() ?? null,
    lastFailedCheckAt: lastFailure?.checkedAt.toISOString() ?? null,
    needsReview: latest ? isNeedsReviewResult(latest) : false,
    lastErrorMessage: lastAttention?.errorMessage ?? null,
  };
}

function sourceHealth(
  source: PropertySourceRecord,
  latest: TrackingEvent | null,
): WatchItemSourceHealth {
  return {
    sourceId: source.id,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    isUsable: isUsableSource(source),
    lastRunStatus: latest?.status ?? null,
    lastCrawlerTier: latest?.crawlerTier ?? null,
    lastCheckedAt: latest?.checkedAt.toISOString() ?? null,
    itemsFound: latest?.itemsFound ?? null,
    needsReview: latest ? isNeedsReviewResult(latest) : false,
    errorMessage: latest?.errorMessage ?? null,
  };
}

function latestEventForSource(
  events: TrackingEvent[],
  sourceId: string,
): TrackingEvent | null {
  return events.find((event) => event.sourceId === sourceId) ?? null;
}

function isUsableSource(source: PropertySourceRecord): boolean {
  return (
    PRICE_CHECK_SOURCE_TYPES.has(source.sourceType) &&
    isHttpUrl(source.sourceUrl)
  );
}

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isNeedsReviewResult(input: {
  status: string;
  itemsFound?: number | null;
}): boolean {
  return (
    input.status === "PARTIAL" ||
    input.status === "NEEDS_REVIEW" ||
    (input.status !== "FAILED" && input.itemsFound === 0)
  );
}

function compareAlertsDesc(a: AlertRecord, b: AlertRecord): number {
  return (
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)
  );
}

function compareEventsDesc(a: TrackingEvent, b: TrackingEvent): number {
  return (
    b.checkedAt.getTime() - a.checkedAt.getTime() || b.id.localeCompare(a.id)
  );
}
