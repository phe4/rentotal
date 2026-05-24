import {
  collectHttpPage,
  type FetchLike,
} from "../collectors/httpCollector.js";
import type { ParsedPriceItem, PriceParser } from "../parsers/priceParser.js";
import { genericHtmlRentParser } from "../parsers/genericHtmlRentParser.js";
import { calculateEffectiveRent } from "./effectiveRent.js";
import type {
  AlertType,
  PriceSnapshotRecord,
  PropertySourceRecord,
  Repository,
  ScrapeRunRecord,
  ScrapeTaskRecord,
} from "../types.js";

const RAW_TEXT_LIMIT = 10_000;
const ACTIVE_WATCH_STATUSES = new Set([
  "WATCHING",
  "CONTACTED",
  "TOURED",
  "APPLIED",
]);

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeRawText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, RAW_TEXT_LIMIT);
}

function durationMs(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}

export class ScrapeService {
  constructor(
    private repository: Repository,
    private parser: PriceParser = genericHtmlRentParser,
    private fetcher?: FetchLike,
  ) {}

  async runTask(taskId: string): Promise<{
    run: ScrapeRunRecord;
    priceSnapshots: PriceSnapshotRecord[];
  }> {
    const task = await this.repository.getScrapeTask(taskId);
    if (!task) throw new Error("Scrape task not found.");
    await this.repository.updateScrapeTask(task.id, {
      status: "RUNNING",
      startedAt: new Date(),
      errorMessage: null,
    });

    const source = task.sourceId
      ? await this.repository.getPropertySource(task.sourceId)
      : null;
    const result = await this.runForSource(source, task);
    await this.repository.updateScrapeTask(task.id, {
      status: result.run.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
      finishedAt: result.run.finishedAt ?? new Date(),
      errorMessage: result.run.errorMessage,
    });
    return result;
  }

  async runSource(sourceId: string): Promise<{
    run: ScrapeRunRecord;
    priceSnapshots: PriceSnapshotRecord[];
  }> {
    const source = await this.repository.getPropertySource(sourceId);
    if (!source) throw new Error("Property source not found.");
    return this.runForSource(source, null);
  }

  private async runForSource(
    source: PropertySourceRecord | null,
    task: ScrapeTaskRecord | null,
  ): Promise<{ run: ScrapeRunRecord; priceSnapshots: PriceSnapshotRecord[] }> {
    const startedAt = new Date();
    const run = await this.repository.createScrapeRun({
      taskId: task?.id ?? null,
      propertyId: source?.propertyId ?? task?.propertyId ?? null,
      sourceId: source?.id ?? task?.sourceId ?? null,
      crawlerTier: "HTTP",
      status: "PARTIAL",
      startedAt,
      finishedAt: null,
      durationMs: null,
      httpStatus: null,
      contentHash: null,
      itemsFound: null,
      rawStorageUrl: null,
      errorMessage: null,
    });

    if (!source) {
      return this.failRun(
        run,
        startedAt,
        "Scrape task must reference a property source.",
      );
    }

    if (!isHttpUrl(source.sourceUrl)) {
      return this.failRun(
        run,
        startedAt,
        "Property source must have a valid HTTP(S) sourceUrl.",
      );
    }

    try {
      const page = await collectHttpPage(source.sourceUrl, this.fetcher);
      await this.repository.createRawPage({
        scrapeRunId: run.id,
        propertyId: source.propertyId,
        sourceId: source.id,
        url: page.url,
        contentType: page.contentType ?? null,
        contentHash: page.contentHash,
        rawText: sanitizeRawText(page.text),
        rawJson: null,
        rawHtmlStorageUrl: null,
      });

      const parsedItems = this.parser.parse({
        url: page.url,
        text: page.text,
        contentType: page.contentType,
      });
      const finishedAt = new Date();

      if (parsedItems.length === 0) {
        await this.createAlertOnce({
          propertyId: source.propertyId,
          watchListItemId: null,
          alertType: "NEEDS_REVIEW",
          title: "Scrape needs review",
          message: `No rent patterns were parsed for source ${source.id}.`,
          severity: "WARNING",
        });
        const updatedRun = await this.repository.updateScrapeRun(run.id, {
          status: "PARTIAL",
          finishedAt,
          durationMs: durationMs(startedAt, finishedAt),
          httpStatus: page.statusCode ?? null,
          contentHash: page.contentHash,
          itemsFound: 0,
          errorMessage: "No rent patterns were parsed from the HTTP response.",
        });
        return { run: updatedRun ?? run, priceSnapshots: [] };
      }

      const snapshots: PriceSnapshotRecord[] = [];
      for (const item of parsedItems) {
        const snapshotData = this.normalizeSnapshotItem(
          source,
          item,
          finishedAt,
        );
        const previous = await this.findPreviousRelevantSnapshot(snapshotData);
        if (previous && trackedValuesEqual(previous, snapshotData)) continue;

        await this.createChangeAlerts(snapshotData, previous);
        await this.createBudgetAlerts(snapshotData);

        snapshots.push(await this.repository.createPriceSnapshot(snapshotData));
      }

      const updatedRun = await this.repository.updateScrapeRun(run.id, {
        status: "SUCCEEDED",
        finishedAt,
        durationMs: durationMs(startedAt, finishedAt),
        httpStatus: page.statusCode ?? null,
        contentHash: page.contentHash,
        itemsFound: parsedItems.length,
        errorMessage: null,
      });
      return { run: updatedRun ?? run, priceSnapshots: snapshots };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "HTTP scrape failed.";
      return this.failRun(run, startedAt, message);
    }
  }

  private async failRun(
    run: ScrapeRunRecord,
    startedAt: Date,
    errorMessage: string,
  ): Promise<{ run: ScrapeRunRecord; priceSnapshots: PriceSnapshotRecord[] }> {
    const finishedAt = new Date();
    const updatedRun = await this.repository.updateScrapeRun(run.id, {
      status: "FAILED",
      finishedAt,
      durationMs: durationMs(startedAt, finishedAt),
      itemsFound: 0,
      errorMessage,
    });
    if (run.propertyId) {
      await this.createAlertOnce({
        propertyId: run.propertyId,
        watchListItemId: null,
        alertType: "SCRAPE_FAILED",
        title: "Scrape failed",
        message: errorMessage,
        severity: "WARNING",
      });
    }
    return { run: updatedRun ?? run, priceSnapshots: [] };
  }

  private normalizeSnapshotItem(
    source: PropertySourceRecord,
    item: ParsedPriceItem,
    scrapedAt: Date,
  ): Omit<PriceSnapshotRecord, "id" | "createdAt"> {
    const baseRent = item.baseRent ?? null;
    const leaseTermMonths = item.leaseTermMonths ?? null;
    const specialOfferText = item.specialOfferText ?? null;
    const specialOfferValue =
      item.specialOfferValue ??
      deriveSpecialOfferValue(specialOfferText, baseRent) ??
      null;
    const mandatoryFees = item.mandatoryFees ?? null;
    const calculatedEffectiveRent = calculateEffectiveRent({
      baseRent,
      leaseTermMonths,
      specialOfferValue,
      mandatoryFees,
    });
    const effectiveRent =
      item.effectiveRent !== undefined &&
      item.effectiveRent !== null &&
      item.effectiveRent >= 0
        ? item.effectiveRent
        : calculatedEffectiveRent;

    return {
      propertyId: source.propertyId,
      sourceId: source.id,
      floorplanName: item.floorplanName ?? null,
      unitNumber: item.unitNumber ?? null,
      bedrooms: item.bedrooms ?? null,
      bathrooms: item.bathrooms ?? null,
      sqft: item.sqft ?? null,
      baseRent,
      effectiveRent,
      leaseTermMonths,
      moveInDate: item.moveInDate ? new Date(item.moveInDate) : null,
      specialOfferText,
      specialOfferValue,
      mandatoryFees,
      availabilityStatus: item.availabilityStatus ?? null,
      scrapedAt,
      rawData: item.rawData ?? null,
      parseStatus: "PARSED",
      errorMessage: null,
    };
  }

  private async findPreviousRelevantSnapshot(
    snapshot: Omit<PriceSnapshotRecord, "id" | "createdAt">,
  ): Promise<PriceSnapshotRecord | null> {
    const snapshots = await this.repository.listPriceSnapshots(
      snapshot.propertyId,
    );
    return (
      snapshots.find(
        (candidate) =>
          candidate.sourceId === snapshot.sourceId &&
          nullable(candidate.floorplanName) ===
            nullable(snapshot.floorplanName) &&
          nullable(candidate.unitNumber) === nullable(snapshot.unitNumber),
      ) ?? null
    );
  }

  private async createChangeAlerts(
    snapshot: Omit<PriceSnapshotRecord, "id" | "createdAt">,
    previous: PriceSnapshotRecord | null,
  ): Promise<void> {
    if (!previous) return;
    const label = snapshotLabel(snapshot);

    if (
      previous.effectiveRent !== null &&
      previous.effectiveRent !== undefined &&
      snapshot.effectiveRent !== null &&
      snapshot.effectiveRent !== undefined &&
      previous.effectiveRent !== snapshot.effectiveRent
    ) {
      const alertType: AlertType =
        snapshot.effectiveRent < previous.effectiveRent
          ? "PRICE_DROPPED"
          : "PRICE_INCREASED";
      await this.createAlertOnce({
        propertyId: snapshot.propertyId,
        watchListItemId: null,
        alertType,
        title:
          alertType === "PRICE_DROPPED" ? "Price dropped" : "Price increased",
        message: `${label} effective rent changed from ${previous.effectiveRent} to ${snapshot.effectiveRent}.`,
        severity: alertType === "PRICE_DROPPED" ? "INFO" : "WARNING",
      });
    }

    if (!previous.specialOfferText && snapshot.specialOfferText) {
      await this.createAlertOnce({
        propertyId: snapshot.propertyId,
        watchListItemId: null,
        alertType: "NEW_SPECIAL_OFFER",
        title: "New special offer",
        message: `${label} has a new special offer: ${snapshot.specialOfferText}.`,
        severity: "INFO",
      });
    } else if (
      previous.specialOfferText &&
      snapshot.specialOfferText &&
      previous.specialOfferText !== snapshot.specialOfferText
    ) {
      await this.createAlertOnce({
        propertyId: snapshot.propertyId,
        watchListItemId: null,
        alertType: "SPECIAL_OFFER_CHANGED",
        title: "Special offer changed",
        message: `${label} special offer changed from ${previous.specialOfferText} to ${snapshot.specialOfferText}.`,
        severity: "INFO",
      });
    }

    if (
      isAvailable(snapshot.availabilityStatus) &&
      !isAvailable(previous.availabilityStatus)
    ) {
      await this.createAlertOnce({
        propertyId: snapshot.propertyId,
        watchListItemId: null,
        alertType: "BECAME_AVAILABLE",
        title: "Became available",
        message: `${label} is now available.`,
        severity: "INFO",
      });
    }
  }

  private async createBudgetAlerts(
    snapshot: Omit<PriceSnapshotRecord, "id" | "createdAt">,
  ): Promise<void> {
    const effectiveRent = snapshot.effectiveRent;
    if (effectiveRent === null || effectiveRent === undefined) return;
    const watchItems = (await this.repository.listWatchListItems()).filter(
      (item) =>
        item.propertyId === snapshot.propertyId &&
        item.targetBudgetMax !== null &&
        ACTIVE_WATCH_STATUSES.has(item.status) &&
        effectiveRent <= item.targetBudgetMax!,
    );

    for (const item of watchItems) {
      await this.createAlertOnce({
        propertyId: snapshot.propertyId,
        watchListItemId: item.id,
        alertType: "ENTERED_BUDGET",
        title: "Entered budget",
        message: `${snapshotLabel(snapshot)} effective rent ${effectiveRent} is within budget ${item.targetBudgetMax}.`,
        severity: "INFO",
      });
    }
  }

  private async createAlertOnce(
    data: Omit<Parameters<Repository["createAlert"]>[0], "isRead">,
  ): Promise<void> {
    const recent = await this.repository.listAlerts({
      propertyId: data.propertyId ?? undefined,
      alertType: data.alertType,
    });
    const duplicate = recent.some(
      (alert) =>
        alert.watchListItemId === data.watchListItemId &&
        alert.message === data.message,
    );
    if (duplicate) return;
    await this.repository.createAlert(data);
  }
}

function deriveSpecialOfferValue(
  specialOfferText: string | null,
  baseRent: number | null,
): number | null {
  if (!specialOfferText || baseRent === null) return null;
  const match = specialOfferText.match(/\b(\d+)\s+(weeks?|months?)\s+free\b/i);
  if (!match?.[1] || !match[2]) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const months = unit.startsWith("week") ? amount / 4 : amount;
  return Math.round(baseRent * months * 100) / 100;
}

function trackedValuesEqual(
  previous: PriceSnapshotRecord,
  current: Omit<PriceSnapshotRecord, "id" | "createdAt">,
): boolean {
  return (
    nullable(previous.floorplanName) === nullable(current.floorplanName) &&
    nullable(previous.unitNumber) === nullable(current.unitNumber) &&
    previous.bedrooms === current.bedrooms &&
    previous.bathrooms === current.bathrooms &&
    previous.sqft === current.sqft &&
    previous.baseRent === current.baseRent &&
    previous.effectiveRent === current.effectiveRent &&
    previous.leaseTermMonths === current.leaseTermMonths &&
    dateValue(previous.moveInDate) === dateValue(current.moveInDate) &&
    nullable(previous.specialOfferText) ===
      nullable(current.specialOfferText) &&
    previous.specialOfferValue === current.specialOfferValue &&
    previous.mandatoryFees === current.mandatoryFees &&
    nullable(previous.availabilityStatus) ===
      nullable(current.availabilityStatus)
  );
}

function snapshotLabel(
  snapshot: Pick<PriceSnapshotRecord, "floorplanName" | "unitNumber">,
): string {
  const parts = [snapshot.floorplanName, snapshot.unitNumber].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Price";
}

function isAvailable(value: string | null | undefined): boolean {
  return value
    ? /\bavailable\b|available/i.test(value) &&
        !/\bunavailable\b|not available/i.test(value)
    : false;
}

function nullable(value: string | null | undefined): string {
  return value ?? "";
}

function dateValue(value: Date | null | undefined): number | null {
  return value?.getTime() ?? null;
}
