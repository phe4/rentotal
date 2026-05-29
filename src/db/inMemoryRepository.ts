import type {
  AlertRecord,
  PriceCheckRunRecord,
  PriceCheckRunResultRecord,
  PriceCheckRunStatus,
  PriceSnapshotRecord,
  PropertyRecord,
  PropertySourceRecord,
  RawPageRecord,
  Repository,
  ScrapeRunRecord,
  ScrapeTaskRecord,
  WatchIntakeRecord,
  WatchListItemRecord,
  WatchListRecord,
} from "../types.js";
import { normalizeName } from "../validation/index.js";

let counter = 0;

function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

function now(): Date {
  return new Date();
}

export class InMemoryRepository implements Repository {
  private properties = new Map<string, PropertyRecord>();
  private sources = new Map<string, PropertySourceRecord>();
  private watchLists = new Map<string, WatchListRecord>();
  private watchItems = new Map<string, WatchListItemRecord>();
  private watchIntakes = new Map<string, WatchIntakeRecord>();
  private priceSnapshots = new Map<string, PriceSnapshotRecord>();
  private scrapeTasks = new Map<string, ScrapeTaskRecord>();
  private scrapeRuns = new Map<string, ScrapeRunRecord>();
  private rawPages = new Map<string, RawPageRecord>();
  private priceCheckRuns = new Map<string, PriceCheckRunRecord>();
  private priceCheckRunResults = new Map<string, PriceCheckRunResultRecord>();
  private alerts = new Map<string, AlertRecord>();

  async createProperty(
    data: Partial<PropertyRecord> & { name: string },
  ): Promise<PropertyRecord> {
    const record: PropertyRecord = {
      id: id("property"),
      name: data.name,
      normalizedName: data.normalizedName ?? normalizeName(data.name),
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      zip: data.zip ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      officialWebsite: data.officialWebsite ?? null,
      propertyType: data.propertyType ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.properties.set(record.id, record);
    return record;
  }

  async listProperties(): Promise<PropertyRecord[]> {
    return [...this.properties.values()];
  }

  async getProperty(id: string): Promise<PropertyRecord | null> {
    return this.properties.get(id) ?? null;
  }

  async updateProperty(
    id: string,
    data: Partial<PropertyRecord>,
  ): Promise<PropertyRecord | null> {
    const existing = this.properties.get(id);
    if (!existing) return null;
    const name = data.name ?? existing.name;
    const updated = {
      ...existing,
      ...data,
      name,
      normalizedName:
        data.normalizedName ??
        (data.name ? normalizeName(data.name) : existing.normalizedName),
      updatedAt: now(),
    };
    this.properties.set(id, updated);
    return updated;
  }

  async deleteProperty(id: string): Promise<boolean> {
    return this.properties.delete(id);
  }

  async createPropertySource(
    data: Omit<PropertySourceRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<PropertySourceRecord | null> {
    if (!this.properties.has(data.propertyId)) return null;
    const record = {
      ...data,
      id: id("source"),
      createdAt: now(),
      updatedAt: now(),
    };
    this.sources.set(record.id, record);
    return record;
  }

  async getPropertySource(id: string): Promise<PropertySourceRecord | null> {
    return this.sources.get(id) ?? null;
  }

  async listPropertySources(
    propertyId: string,
  ): Promise<PropertySourceRecord[]> {
    return [...this.sources.values()].filter(
      (source) => source.propertyId === propertyId,
    );
  }

  async updatePropertySource(
    id: string,
    data: Partial<PropertySourceRecord>,
  ): Promise<PropertySourceRecord | null> {
    const existing = this.sources.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    this.sources.set(id, updated);
    return updated;
  }

  async deletePropertySource(sourceId: string): Promise<boolean> {
    return this.sources.delete(sourceId);
  }

  async listWatchLists(): Promise<WatchListRecord[]> {
    return [...this.watchLists.values()];
  }

  async createWatchList(data: {
    name: string;
    description?: string | null;
  }): Promise<WatchListRecord> {
    const record = {
      id: id("watch_list"),
      name: data.name,
      description: data.description ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.watchLists.set(record.id, record);
    return record;
  }

  async getWatchList(id: string): Promise<WatchListRecord | null> {
    return this.watchLists.get(id) ?? null;
  }

  async getOrCreateDefaultWatchList(): Promise<WatchListRecord> {
    const existing = [...this.watchLists.values()].find(
      (list) => list.name === "Default Watch List",
    );
    return existing ?? this.createWatchList({ name: "Default Watch List" });
  }

  async createWatchListItem(
    data: Omit<WatchListItemRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchListItemRecord> {
    const record = {
      ...data,
      id: id("watch_item"),
      createdAt: now(),
      updatedAt: now(),
    };
    this.watchItems.set(record.id, record);
    return record;
  }

  async listWatchListItems(): Promise<WatchListItemRecord[]> {
    return [...this.watchItems.values()];
  }

  async getWatchListItem(id: string): Promise<WatchListItemRecord | null> {
    return this.watchItems.get(id) ?? null;
  }

  async updateWatchListItem(
    id: string,
    data: Partial<WatchListItemRecord>,
  ): Promise<WatchListItemRecord | null> {
    const existing = this.watchItems.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    this.watchItems.set(id, updated);
    return updated;
  }

  async deleteWatchListItem(id: string): Promise<boolean> {
    return this.watchItems.delete(id);
  }

  async createWatchIntake(
    data: Omit<WatchIntakeRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchIntakeRecord> {
    const record = {
      ...data,
      id: id("intake"),
      createdAt: now(),
      updatedAt: now(),
    };
    this.watchIntakes.set(record.id, record);
    return record;
  }

  async listWatchIntakes(): Promise<WatchIntakeRecord[]> {
    return [...this.watchIntakes.values()];
  }

  async getWatchIntake(id: string): Promise<WatchIntakeRecord | null> {
    return this.watchIntakes.get(id) ?? null;
  }

  async listPriceSnapshots(propertyId: string): Promise<PriceSnapshotRecord[]> {
    return [...this.priceSnapshots.values()]
      .filter((snapshot) => snapshot.propertyId === propertyId)
      .sort((a, b) => snapshotTime(b) - snapshotTime(a));
  }

  async listPriceHistory(propertyId: string): Promise<PriceSnapshotRecord[]> {
    return [...this.priceSnapshots.values()]
      .filter((snapshot) => snapshot.propertyId === propertyId)
      .sort((a, b) => snapshotTime(a) - snapshotTime(b));
  }

  async getLatestPriceSnapshot(
    propertyId: string,
  ): Promise<PriceSnapshotRecord | null> {
    const snapshots = await this.listPriceSnapshots(propertyId);
    return snapshots[0] ?? null;
  }

  async createPriceSnapshot(
    data: Omit<PriceSnapshotRecord, "id" | "createdAt">,
  ): Promise<PriceSnapshotRecord> {
    const record = { ...data, id: id("price_snapshot"), createdAt: now() };
    this.priceSnapshots.set(record.id, record);
    return record;
  }

  async createScrapeTask(
    data: Omit<ScrapeTaskRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ScrapeTaskRecord | null> {
    if (data.propertyId && !this.properties.has(data.propertyId)) return null;
    if (data.sourceId && !this.sources.has(data.sourceId)) return null;
    const record = {
      ...data,
      id: id("scrape_task"),
      createdAt: now(),
      updatedAt: now(),
    };
    this.scrapeTasks.set(record.id, record);
    return record;
  }

  async listScrapeTasks(): Promise<ScrapeTaskRecord[]> {
    return [...this.scrapeTasks.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getScrapeTask(id: string): Promise<ScrapeTaskRecord | null> {
    return this.scrapeTasks.get(id) ?? null;
  }

  async updateScrapeTask(
    id: string,
    data: Partial<ScrapeTaskRecord>,
  ): Promise<ScrapeTaskRecord | null> {
    const existing = this.scrapeTasks.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    this.scrapeTasks.set(id, updated);
    return updated;
  }

  async createScrapeRun(
    data: Omit<ScrapeRunRecord, "id" | "createdAt">,
  ): Promise<ScrapeRunRecord> {
    const record = { ...data, id: id("scrape_run"), createdAt: now() };
    this.scrapeRuns.set(record.id, record);
    return record;
  }

  async listScrapeRuns(): Promise<ScrapeRunRecord[]> {
    return [...this.scrapeRuns.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getScrapeRun(id: string): Promise<ScrapeRunRecord | null> {
    return this.scrapeRuns.get(id) ?? null;
  }

  async updateScrapeRun(
    id: string,
    data: Partial<ScrapeRunRecord>,
  ): Promise<ScrapeRunRecord | null> {
    const existing = this.scrapeRuns.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.scrapeRuns.set(id, updated);
    return updated;
  }

  async createRawPage(
    data: Omit<RawPageRecord, "id" | "createdAt">,
  ): Promise<RawPageRecord> {
    const record = { ...data, id: id("raw_page"), createdAt: now() };
    this.rawPages.set(record.id, record);
    return record;
  }

  async createPriceCheckRun(
    data: Omit<PriceCheckRunRecord, "id" | "createdAt">,
  ): Promise<PriceCheckRunRecord> {
    const record = { ...data, id: id("price_check_run"), createdAt: now() };
    this.priceCheckRuns.set(record.id, record);
    return record;
  }

  async updatePriceCheckRun(
    id: string,
    data: Partial<PriceCheckRunRecord>,
  ): Promise<PriceCheckRunRecord | null> {
    const existing = this.priceCheckRuns.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.priceCheckRuns.set(id, updated);
    return updated;
  }

  async listPriceCheckRuns(filters?: {
    limit?: number;
    status?: PriceCheckRunStatus;
  }): Promise<PriceCheckRunRecord[]> {
    return [...this.priceCheckRuns.values()]
      .filter((run) =>
        filters?.status === undefined ? true : run.status === filters.status,
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, filters?.limit ?? 20);
  }

  async getPriceCheckRun(id: string): Promise<PriceCheckRunRecord | null> {
    return this.priceCheckRuns.get(id) ?? null;
  }

  async createPriceCheckRunResult(
    data: Omit<PriceCheckRunResultRecord, "id" | "createdAt">,
  ): Promise<PriceCheckRunResultRecord> {
    const record = {
      ...data,
      id: id("price_check_result"),
      createdAt: now(),
    };
    this.priceCheckRunResults.set(record.id, record);
    return record;
  }

  async listPriceCheckRunResults(
    priceCheckRunId?: string,
  ): Promise<PriceCheckRunResultRecord[]> {
    return [...this.priceCheckRunResults.values()]
      .filter((result) =>
        priceCheckRunId === undefined
          ? true
          : result.priceCheckRunId === priceCheckRunId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAlerts(filters?: {
    isRead?: boolean;
    propertyId?: string;
    alertType?: AlertRecord["alertType"];
  }): Promise<AlertRecord[]> {
    return [...this.alerts.values()]
      .filter((alert) =>
        filters?.isRead === undefined ? true : alert.isRead === filters.isRead,
      )
      .filter((alert) =>
        filters?.propertyId === undefined
          ? true
          : alert.propertyId === filters.propertyId,
      )
      .filter((alert) =>
        filters?.alertType === undefined
          ? true
          : alert.alertType === filters.alertType,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAlert(
    data: Omit<AlertRecord, "id" | "createdAt" | "isRead"> & {
      isRead?: boolean;
    },
  ): Promise<AlertRecord> {
    const record = {
      ...data,
      id: id("alert"),
      isRead: data.isRead ?? false,
      createdAt: now(),
    };
    this.alerts.set(record.id, record);
    return record;
  }

  async createAlertForTest(
    data: Omit<AlertRecord, "id" | "createdAt">,
  ): Promise<AlertRecord> {
    return this.createAlert(data);
  }

  async markAlertRead(id: string): Promise<AlertRecord | null> {
    const existing = this.alerts.get(id);
    if (!existing) return null;
    const updated = { ...existing, isRead: true };
    this.alerts.set(id, updated);
    return updated;
  }
}

function snapshotTime(snapshot: PriceSnapshotRecord): number {
  return (snapshot.scrapedAt ?? snapshot.createdAt).getTime();
}
