import {
  collectHttpPage,
  type FetchLike,
} from "../collectors/httpCollector.js";
import type { PriceParser } from "../parsers/priceParser.js";
import { genericHtmlRentParser } from "../parsers/genericHtmlRentParser.js";
import type {
  PriceSnapshotRecord,
  PropertySourceRecord,
  Repository,
  ScrapeRunRecord,
  ScrapeTaskRecord,
} from "../types.js";

const RAW_TEXT_LIMIT = 10_000;

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
        snapshots.push(
          await this.repository.createPriceSnapshot({
            propertyId: source.propertyId,
            sourceId: source.id,
            floorplanName: item.floorplanName ?? null,
            unitNumber: item.unitNumber ?? null,
            bedrooms: item.bedrooms ?? null,
            bathrooms: item.bathrooms ?? null,
            sqft: item.sqft ?? null,
            baseRent: item.baseRent ?? null,
            effectiveRent: item.effectiveRent ?? null,
            leaseTermMonths: item.leaseTermMonths ?? null,
            moveInDate: item.moveInDate ? new Date(item.moveInDate) : null,
            specialOfferText: item.specialOfferText ?? null,
            specialOfferValue: item.specialOfferValue ?? null,
            mandatoryFees: item.mandatoryFees ?? null,
            availabilityStatus: item.availabilityStatus ?? null,
            scrapedAt: finishedAt,
            rawData: item.rawData ?? null,
            parseStatus: "PARSED",
            errorMessage: null,
          }),
        );
      }

      const updatedRun = await this.repository.updateScrapeRun(run.id, {
        status: "SUCCEEDED",
        finishedAt,
        durationMs: durationMs(startedAt, finishedAt),
        httpStatus: page.statusCode ?? null,
        contentHash: page.contentHash,
        itemsFound: snapshots.length,
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
    return { run: updatedRun ?? run, priceSnapshots: [] };
  }
}
