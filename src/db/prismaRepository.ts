import type { PrismaClient } from "@prisma/client";
import type {
  AlertRecord,
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

  async getPropertySource(id: string): Promise<PropertySourceRecord | null> {
    return this.prisma.propertySource.findUnique({ where: { id } });
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
    const snapshots = await this.prisma.priceSnapshot.findMany({
      where: { propertyId },
    });
    return snapshots.sort((a, b) => snapshotTime(b) - snapshotTime(a));
  }

  async listPriceHistory(propertyId: string): Promise<PriceSnapshotRecord[]> {
    const snapshots = await this.prisma.priceSnapshot.findMany({
      where: { propertyId },
    });
    return snapshots.sort((a, b) => snapshotTime(a) - snapshotTime(b));
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
    return this.prisma.priceSnapshot.create({
      data: {
        propertyId: data.propertyId,
        sourceId: data.sourceId,
        floorplanName: data.floorplanName,
        unitNumber: data.unitNumber,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqft: data.sqft,
        baseRent: data.baseRent,
        effectiveRent: data.effectiveRent,
        leaseTermMonths: data.leaseTermMonths,
        moveInDate: data.moveInDate,
        specialOfferText: data.specialOfferText,
        specialOfferValue: data.specialOfferValue,
        mandatoryFees: data.mandatoryFees,
        availabilityStatus: data.availabilityStatus,
        scrapedAt: data.scrapedAt,
        rawData: data.rawData === null ? undefined : data.rawData,
        parseStatus: data.parseStatus === "PARSED" ? "PARSED" : "NOT_PARSED",
        errorMessage: data.errorMessage,
      },
    });
  }

  async createScrapeTask(
    data: Omit<ScrapeTaskRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ScrapeTaskRecord | null> {
    if (data.propertyId && !(await this.getProperty(data.propertyId)))
      return null;
    if (data.sourceId && !(await this.getPropertySource(data.sourceId)))
      return null;
    return this.prisma.scrapeTask.create({ data });
  }

  async listScrapeTasks(): Promise<ScrapeTaskRecord[]> {
    return this.prisma.scrapeTask.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getScrapeTask(id: string): Promise<ScrapeTaskRecord | null> {
    return this.prisma.scrapeTask.findUnique({ where: { id } });
  }

  async updateScrapeTask(
    id: string,
    data: Partial<ScrapeTaskRecord>,
  ): Promise<ScrapeTaskRecord | null> {
    try {
      return await this.prisma.scrapeTask.update({
        where: { id },
        data: withoutUndefined({
          propertyId: data.propertyId,
          sourceId: data.sourceId,
          taskType: data.taskType,
          priority: data.priority,
          status: data.status,
          scheduledAt: data.scheduledAt,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          crawlerTier: data.crawlerTier,
          errorMessage: data.errorMessage,
        }),
      });
    } catch {
      return null;
    }
  }

  async createScrapeRun(
    data: Omit<ScrapeRunRecord, "id" | "createdAt">,
  ): Promise<ScrapeRunRecord> {
    return this.prisma.scrapeRun.create({ data });
  }

  async listScrapeRuns(): Promise<ScrapeRunRecord[]> {
    return this.prisma.scrapeRun.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getScrapeRun(id: string): Promise<ScrapeRunRecord | null> {
    return this.prisma.scrapeRun.findUnique({ where: { id } });
  }

  async updateScrapeRun(
    id: string,
    data: Partial<ScrapeRunRecord>,
  ): Promise<ScrapeRunRecord | null> {
    try {
      return await this.prisma.scrapeRun.update({
        where: { id },
        data: withoutUndefined({
          taskId: data.taskId,
          propertyId: data.propertyId,
          sourceId: data.sourceId,
          crawlerTier: data.crawlerTier,
          status: data.status,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          durationMs: data.durationMs,
          httpStatus: data.httpStatus,
          contentHash: data.contentHash,
          itemsFound: data.itemsFound,
          rawStorageUrl: data.rawStorageUrl,
          errorMessage: data.errorMessage,
        }),
      });
    } catch {
      return null;
    }
  }

  async createRawPage(
    data: Omit<RawPageRecord, "id" | "createdAt">,
  ): Promise<RawPageRecord> {
    return this.prisma.rawPage.create({
      data: {
        scrapeRunId: data.scrapeRunId,
        propertyId: data.propertyId,
        sourceId: data.sourceId,
        url: data.url,
        contentType: data.contentType,
        contentHash: data.contentHash,
        rawText: data.rawText,
        rawJson: data.rawJson === null ? undefined : data.rawJson,
        rawHtmlStorageUrl: data.rawHtmlStorageUrl,
      },
    });
  }

  async listAlerts(filters?: {
    isRead?: boolean;
    propertyId?: string;
    alertType?: AlertRecord["alertType"];
  }): Promise<AlertRecord[]> {
    return this.prisma.alert.findMany({
      where: {
        isRead: filters?.isRead,
        propertyId: filters?.propertyId,
        alertType: filters?.alertType,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAlert(
    data: Omit<AlertRecord, "id" | "createdAt" | "isRead"> & {
      isRead?: boolean;
    },
  ): Promise<AlertRecord> {
    return this.prisma.alert.create({
      data: {
        propertyId: data.propertyId,
        watchListItemId: data.watchListItemId,
        alertType: data.alertType,
        title: data.title,
        message: data.message,
        severity: data.severity,
        isRead: data.isRead ?? false,
      },
    });
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

function snapshotTime(snapshot: PriceSnapshotRecord): number {
  return (snapshot.scrapedAt ?? snapshot.createdAt).getTime();
}
