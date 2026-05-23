import type { PrismaClient } from "@prisma/client";
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

function withoutUndefined<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export class PrismaRepository implements Repository {
  constructor(private prisma: PrismaClient) {}

  async createProperty(
    data: Partial<PropertyRecord> & { name: string },
  ): Promise<PropertyRecord> {
    return this.prisma.property.create({
      data: {
        name: data.name,
        normalizedName: data.normalizedName ?? normalizeName(data.name),
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        lat: data.lat,
        lng: data.lng,
        officialWebsite: data.officialWebsite,
        propertyType: data.propertyType,
      },
    });
  }

  async listProperties(): Promise<PropertyRecord[]> {
    return this.prisma.property.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getProperty(id: string): Promise<PropertyRecord | null> {
    return this.prisma.property.findUnique({ where: { id } });
  }

  async updateProperty(
    id: string,
    data: Partial<PropertyRecord>,
  ): Promise<PropertyRecord | null> {
    try {
      return await this.prisma.property.update({
        where: { id },
        data: withoutUndefined({
          name: data.name,
          normalizedName: data.name
            ? normalizeName(data.name)
            : data.normalizedName,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          lat: data.lat,
          lng: data.lng,
          officialWebsite: data.officialWebsite,
          propertyType: data.propertyType,
        }),
      });
    } catch {
      return null;
    }
  }

  async deleteProperty(id: string): Promise<boolean> {
    try {
      await this.prisma.property.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async createPropertySource(
    data: Omit<PropertySourceRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<PropertySourceRecord | null> {
    const property = await this.getProperty(data.propertyId);
    if (!property) return null;
    return this.prisma.propertySource.create({
      data: {
        propertyId: data.propertyId,
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl,
        sourceExternalId: data.sourceExternalId,
        isPrimary: data.isPrimary,
        metadata: data.metadata === null ? undefined : data.metadata,
      },
    });
  }

  async listPropertySources(
    propertyId: string,
  ): Promise<PropertySourceRecord[]> {
    return this.prisma.propertySource.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deletePropertySource(sourceId: string): Promise<boolean> {
    try {
      await this.prisma.propertySource.delete({ where: { id: sourceId } });
      return true;
    } catch {
      return false;
    }
  }

  async listWatchLists(): Promise<WatchListRecord[]> {
    return this.prisma.watchList.findMany({ orderBy: { createdAt: "desc" } });
  }

  async createWatchList(data: {
    name: string;
    description?: string | null;
  }): Promise<WatchListRecord> {
    return this.prisma.watchList.create({ data });
  }

  async getWatchList(id: string): Promise<WatchListRecord | null> {
    return this.prisma.watchList.findUnique({ where: { id } });
  }

  async getOrCreateDefaultWatchList(): Promise<WatchListRecord> {
    const existing = await this.prisma.watchList.findFirst({
      where: { name: "Default Watch List" },
    });
    return existing ?? this.createWatchList({ name: "Default Watch List" });
  }

  async createWatchListItem(
    data: Omit<WatchListItemRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchListItemRecord> {
    return this.prisma.watchListItem.create({ data });
  }

  async listWatchListItems(): Promise<WatchListItemRecord[]> {
    return this.prisma.watchListItem.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getWatchListItem(id: string): Promise<WatchListItemRecord | null> {
    return this.prisma.watchListItem.findUnique({ where: { id } });
  }

  async updateWatchListItem(
    id: string,
    data: Partial<WatchListItemRecord>,
  ): Promise<WatchListItemRecord | null> {
    try {
      return await this.prisma.watchListItem.update({
        where: { id },
        data: withoutUndefined({
          targetBedrooms: data.targetBedrooms,
          targetBathrooms: data.targetBathrooms,
          targetMoveInDate: data.targetMoveInDate,
          targetBudgetMin: data.targetBudgetMin,
          targetBudgetMax: data.targetBudgetMax,
          priority: data.priority,
          notes: data.notes,
          status: data.status,
        }),
      });
    } catch {
      return null;
    }
  }

  async deleteWatchListItem(id: string): Promise<boolean> {
    try {
      await this.prisma.watchListItem.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async createWatchIntake(
    data: Omit<WatchIntakeRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchIntakeRecord> {
    return this.prisma.watchIntake.create({ data });
  }

  async listWatchIntakes(): Promise<WatchIntakeRecord[]> {
    return this.prisma.watchIntake.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getWatchIntake(id: string): Promise<WatchIntakeRecord | null> {
    return this.prisma.watchIntake.findUnique({ where: { id } });
  }

  async listPriceSnapshots(propertyId: string): Promise<PriceSnapshotRecord[]> {
    return this.prisma.priceSnapshot.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getLatestPriceSnapshot(
    propertyId: string,
  ): Promise<PriceSnapshotRecord | null> {
    return this.prisma.priceSnapshot.findFirst({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listAlerts(): Promise<AlertRecord[]> {
    return this.prisma.alert.findMany({ orderBy: { createdAt: "desc" } });
  }

  async markAlertRead(id: string): Promise<AlertRecord | null> {
    try {
      return await this.prisma.alert.update({
        where: { id },
        data: { isRead: true },
      });
    } catch {
      return null;
    }
  }
}
