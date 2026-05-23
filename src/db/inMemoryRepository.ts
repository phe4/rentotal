import type {
  AlertRecord,
  PriceSnapshotRecord,
  PropertyRecord,
  PropertySourceRecord,
  Repository,
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

  async listPropertySources(
    propertyId: string,
  ): Promise<PropertySourceRecord[]> {
    return [...this.sources.values()].filter(
      (source) => source.propertyId === propertyId,
    );
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
    return [...this.priceSnapshots.values()].filter(
      (snapshot) => snapshot.propertyId === propertyId,
    );
  }

  async getLatestPriceSnapshot(
    propertyId: string,
  ): Promise<PriceSnapshotRecord | null> {
    const snapshots = await this.listPriceSnapshots(propertyId);
    return (
      snapshots.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
    );
  }

  async listAlerts(): Promise<AlertRecord[]> {
    return [...this.alerts.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async createAlertForTest(
    data: Omit<AlertRecord, "id" | "createdAt">,
  ): Promise<AlertRecord> {
    const record = { ...data, id: id("alert"), createdAt: now() };
    this.alerts.set(record.id, record);
    return record;
  }

  async markAlertRead(id: string): Promise<AlertRecord | null> {
    const existing = this.alerts.get(id);
    if (!existing) return null;
    const updated = { ...existing, isRead: true };
    this.alerts.set(id, updated);
    return updated;
  }
}
