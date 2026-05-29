import { ScrapeService, type ScrapeServiceOptions } from "./scrapeService.js";
import type {
  PriceCheckRunRecord,
  PriceCheckRunResultRecord,
  PriceCheckRunStatus,
  PropertySourceRecord,
  Repository,
  ScrapeRunRecord,
  ScrapeTaskRecord,
  WatchListItemRecord,
} from "../types.js";

export type RunAllOptions = {
  dryRun?: boolean;
  cooldownMinutes?: number;
  force?: boolean;
  maxSources?: number;
};

export type PriceCheckSkipReason =
  | "NO_SOURCE_URL"
  | "INVALID_URL"
  | "UNSUPPORTED_SOURCE_TYPE"
  | "COOLDOWN_ACTIVE"
  | "MAX_SOURCES_LIMIT"
  | "DRY_RUN"
  | "DUPLICATE_SOURCE";

export type ScheduledPriceCheckSkippedSource = {
  propertyId?: string;
  watchListItemId?: string;
  sourceId?: string;
  reason: PriceCheckSkipReason;
  message: string;
};

export type ScheduledPriceCheckResult = {
  propertyId?: string;
  sourceId: string;
  scrapeRunId?: string;
  status: string;
  crawlerTier?: string;
  itemsFound?: number;
  errorMessage?: string;
};

export type ScheduledPriceCheckSummary = {
  id?: string;
  startedAt: string;
  finishedAt: string;
  dryRun?: boolean;
  status: PriceCheckRunStatus;
  watchItemsScanned: number;
  sourcesSelected: number;
  sourcesSkipped: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
  skipped: ScheduledPriceCheckSkippedSource[];
  results: ScheduledPriceCheckResult[];
};

export type ScheduledPriceCheckExecutor = (
  task: ScrapeTaskRecord,
  source: PropertySourceRecord,
) => Promise<{ run: ScrapeRunRecord }>;

export type ScheduledPriceCheckServiceOptions = {
  scrapeService?: ScrapeServiceOptions;
  executeTask?: ScheduledPriceCheckExecutor;
};

export type PriceCheckRunDetail = {
  run: PriceCheckRunRecord;
  results: PriceCheckRunResultRecord[];
};

export type PriceCheckHealthIssue = {
  type: string;
  propertyId?: string;
  watchListItemId?: string;
  sourceId?: string;
  message: string;
};

export type PriceCheckHealthSummary = {
  generatedAt: string;
  lastRunAt?: string;
  activeWatchItems: number;
  watchItemsWithoutSources: number;
  usableSources: number;
  sourcesWithRecentSuccess: number;
  sourcesWithRecentFailure: number;
  sourcesNeedingReview: number;
  recentRuns: Array<{
    id: string;
    startedAt: string;
    status: string;
    sourcesSelected: number;
    sourcesSucceeded: number;
    sourcesFailed: number;
    sourcesNeedsReview: number;
  }>;
  issues: PriceCheckHealthIssue[];
};

const PRICE_CHECK_SOURCE_TYPES = new Set([
  "FLOORPLAN_URL",
  "OFFICIAL_SITE",
  "OTHER",
]);

const MINUTE_MS = 60_000;

export class ScheduledPriceCheckService {
  private scrapeService: ScrapeService;
  private executeTask: ScheduledPriceCheckExecutor;

  constructor(
    private repository: Repository,
    options: ScheduledPriceCheckServiceOptions = {},
  ) {
    this.scrapeService = new ScrapeService(repository, options.scrapeService);
    this.executeTask =
      options.executeTask ?? ((task) => this.scrapeService.runTask(task.id));
  }

  async runAll(
    options: RunAllOptions = {},
  ): Promise<ScheduledPriceCheckSummary> {
    const startedAt = new Date();
    const watchItems = (await this.repository.listWatchListItems()).filter(
      (item) => item.status === "WATCHING",
    );
    const selection = await this.selectSourcesForRun(watchItems, options);
    const sources = selection.sources;
    const skipped = [...selection.skipped];
    const results: ScheduledPriceCheckResult[] = [];

    if (options.dryRun) {
      for (const source of sources) {
        results.push({
          propertyId: source.propertyId,
          sourceId: source.id,
          status: "DRY_RUN",
          itemsFound: 0,
        });
        skipped.push({
          propertyId: source.propertyId,
          sourceId: source.id,
          reason: "DRY_RUN",
          message: "Dry run selected this source but did not execute it.",
        });
      }
      const finishedAt = new Date();
      return {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        dryRun: true,
        status: "SUCCEEDED",
        watchItemsScanned: watchItems.length,
        sourcesSelected: sources.length,
        sourcesSkipped: skipped.length,
        sourcesSucceeded: 0,
        sourcesFailed: 0,
        sourcesNeedsReview: 0,
        skipped,
        results,
      };
    }

    const runRecord = await this.repository.createPriceCheckRun({
      startedAt,
      finishedAt: null,
      status: "PARTIAL",
      watchItemsScanned: watchItems.length,
      sourcesSelected: sources.length,
      sourcesSucceeded: 0,
      sourcesFailed: 0,
      sourcesNeedsReview: 0,
    });

    for (const source of sources) {
      const task = await this.repository.createScrapeTask({
        propertyId: source.propertyId,
        sourceId: source.id,
        taskType: "PRICE_CHECK",
        priority: "MEDIUM",
        status: "PENDING",
        scheduledAt: null,
        startedAt: null,
        finishedAt: null,
        retryCount: 0,
        maxRetries: 3,
        crawlerTier: "HTTP",
        errorMessage: null,
      });

      if (!task) {
        const result = {
          propertyId: source.propertyId,
          sourceId: source.id,
          status: "FAILED",
          crawlerTier: "HTTP",
          itemsFound: 0,
          errorMessage: "Unable to create PRICE_CHECK scrape task.",
        };
        results.push(result);
        await this.persistResult(runRecord.id, result);
        continue;
      }

      try {
        const { run } = await this.executeTask(task, source);
        const result = resultFromRun(run, source);
        results.push(result);
        await this.persistResult(runRecord.id, result);
      } catch (error) {
        const result = {
          propertyId: source.propertyId,
          sourceId: source.id,
          status: "FAILED",
          crawlerTier: task.crawlerTier,
          itemsFound: 0,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Scheduled price check failed.",
        };
        results.push(result);
        await this.persistResult(runRecord.id, result);
      }
    }

    const finishedAt = new Date();
    const counts = summarizeResults(results);
    const status = priceCheckRunStatus(results, sources.length);
    const updatedRun = await this.repository.updatePriceCheckRun(runRecord.id, {
      finishedAt,
      status,
      sourcesSucceeded: counts.sourcesSucceeded,
      sourcesFailed: counts.sourcesFailed,
      sourcesNeedsReview: counts.sourcesNeedsReview,
    });
    return {
      id: updatedRun?.id ?? runRecord.id,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      status,
      watchItemsScanned: watchItems.length,
      sourcesSelected: sources.length,
      sourcesSkipped: skipped.length,
      sourcesSucceeded: counts.sourcesSucceeded,
      sourcesFailed: counts.sourcesFailed,
      sourcesNeedsReview: counts.sourcesNeedsReview,
      skipped,
      results,
    };
  }

  async listRuns(filters?: {
    limit?: number;
    status?: PriceCheckRunStatus;
  }): Promise<PriceCheckRunRecord[]> {
    return this.repository.listPriceCheckRuns(filters);
  }

  async getRun(id: string): Promise<PriceCheckRunDetail | null> {
    const run = await this.repository.getPriceCheckRun(id);
    if (!run) return null;
    return {
      run,
      results: await this.repository.listPriceCheckRunResults(run.id),
    };
  }

  async getHealth(): Promise<PriceCheckHealthSummary> {
    const activeItems = (await this.repository.listWatchListItems()).filter(
      (item) => item.status === "WATCHING",
    );
    const issues: PriceCheckHealthIssue[] = [];
    const usableSourcesById = new Map<string, PropertySourceRecord>();
    let watchItemsWithoutSources = 0;

    for (const item of activeItems) {
      const sources = await this.usableSourcesForWatchItem(item);
      if (sources.length === 0) {
        watchItemsWithoutSources += 1;
        issues.push({
          type: "NO_USABLE_SOURCE",
          propertyId: item.propertyId,
          watchListItemId: item.id,
          message: "Watching item has no usable price-check source.",
        });
        continue;
      }
      for (const source of sources) {
        usableSourcesById.set(source.id, source);
      }
    }

    const recentRuns = await this.repository.listPriceCheckRuns({ limit: 5 });
    const allResults = await this.repository.listPriceCheckRunResults();
    const latestResults = latestResultBySource(
      allResults,
      new Set(usableSourcesById.keys()),
    );

    let sourcesWithRecentSuccess = 0;
    let sourcesWithRecentFailure = 0;
    let sourcesNeedingReview = 0;
    for (const result of latestResults.values()) {
      if (result.status === "SUCCEEDED") {
        sourcesWithRecentSuccess += 1;
      } else if (result.status === "FAILED") {
        sourcesWithRecentFailure += 1;
        issues.push({
          type: "SOURCE_RECENT_FAILURE",
          propertyId: result.propertyId ?? undefined,
          sourceId: result.sourceId ?? undefined,
          message:
            result.errorMessage ??
            "Latest price-check result for this source failed.",
        });
      } else if (isNeedsReviewResult(result)) {
        sourcesNeedingReview += 1;
        issues.push({
          type: "SOURCE_NEEDS_REVIEW",
          propertyId: result.propertyId ?? undefined,
          sourceId: result.sourceId ?? undefined,
          message:
            result.errorMessage ??
            "Latest price-check result for this source needs review.",
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      lastRunAt: recentRuns[0]?.startedAt.toISOString(),
      activeWatchItems: activeItems.length,
      watchItemsWithoutSources,
      usableSources: usableSourcesById.size,
      sourcesWithRecentSuccess,
      sourcesWithRecentFailure,
      sourcesNeedingReview,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        startedAt: run.startedAt.toISOString(),
        status: run.status,
        sourcesSelected: run.sourcesSelected,
        sourcesSucceeded: run.sourcesSucceeded,
        sourcesFailed: run.sourcesFailed,
        sourcesNeedsReview: run.sourcesNeedsReview,
      })),
      issues,
    };
  }

  private async selectSourcesForRun(
    watchItems: WatchListItemRecord[],
    options: RunAllOptions,
  ): Promise<{
    sources: PropertySourceRecord[];
    skipped: ScheduledPriceCheckSkippedSource[];
  }> {
    const selected = new Map<string, PropertySourceRecord>();
    const skipped: ScheduledPriceCheckSkippedSource[] = [];
    const cooldownCheckedAt = options.force
      ? new Map<string, Date>()
      : await this.latestAttemptBySource();
    for (const item of watchItems) {
      const property = await this.repository.getProperty(item.propertyId);
      if (!property) continue;
      const sources = await this.repository.listPropertySources(property.id);
      for (const source of sources) {
        const sourceSkip = skipForSource(source, item.id);
        if (sourceSkip) {
          skipped.push(sourceSkip);
          continue;
        }
        if (selected.has(source.id)) {
          skipped.push({
            propertyId: source.propertyId,
            watchListItemId: item.id,
            sourceId: source.id,
            reason: "DUPLICATE_SOURCE",
            message: "Source was already selected earlier in this run.",
          });
          continue;
        }
        if (
          !options.force &&
          options.cooldownMinutes !== undefined &&
          options.cooldownMinutes > 0
        ) {
          const latestAttempt = cooldownCheckedAt.get(source.id);
          if (
            latestAttempt &&
            startedWithinCooldown(latestAttempt, options.cooldownMinutes)
          ) {
            skipped.push({
              propertyId: source.propertyId,
              watchListItemId: item.id,
              sourceId: source.id,
              reason: "COOLDOWN_ACTIVE",
              message: `Source was checked within the last ${options.cooldownMinutes} minutes.`,
            });
            continue;
          }
        }
        selected.set(source.id, source);
      }
    }
    const sources = [...selected.values()];
    if (
      options.maxSources !== undefined &&
      sources.length > options.maxSources
    ) {
      const limited = sources.slice(0, options.maxSources);
      for (const source of sources.slice(options.maxSources)) {
        skipped.push({
          propertyId: source.propertyId,
          sourceId: source.id,
          reason: "MAX_SOURCES_LIMIT",
          message: `Source skipped because maxSources is ${options.maxSources}.`,
        });
      }
      return { sources: limited, skipped };
    }
    return { sources, skipped };
  }

  private async usableSourcesForWatchItem(
    item: WatchListItemRecord,
  ): Promise<PropertySourceRecord[]> {
    const property = await this.repository.getProperty(item.propertyId);
    if (!property) return [];
    return (await this.repository.listPropertySources(property.id)).filter(
      isPriceCheckSource,
    );
  }

  private async latestAttemptBySource(): Promise<Map<string, Date>> {
    const latest = new Map<string, Date>();
    for (const result of await this.repository.listPriceCheckRunResults()) {
      if (!result.sourceId) continue;
      setLatest(latest, result.sourceId, result.createdAt);
    }
    for (const run of await this.repository.listScrapeRuns()) {
      if (!run.sourceId) continue;
      setLatest(latest, run.sourceId, run.startedAt ?? run.createdAt);
    }
    return latest;
  }

  private async persistResult(
    priceCheckRunId: string,
    result: ScheduledPriceCheckResult,
  ): Promise<void> {
    await this.repository.createPriceCheckRunResult({
      priceCheckRunId,
      propertyId: result.propertyId ?? null,
      sourceId: result.sourceId,
      scrapeRunId: result.scrapeRunId ?? null,
      status: result.status,
      crawlerTier: result.crawlerTier ?? null,
      itemsFound: result.itemsFound ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  }
}

function resultFromRun(
  run: ScrapeRunRecord,
  source: PropertySourceRecord,
): ScheduledPriceCheckResult {
  return {
    propertyId: run.propertyId ?? source.propertyId,
    sourceId: run.sourceId ?? source.id,
    scrapeRunId: run.id,
    status: run.status,
    crawlerTier: run.crawlerTier,
    itemsFound: run.itemsFound ?? undefined,
    errorMessage: run.errorMessage ?? undefined,
  };
}

function isPriceCheckSource(source: PropertySourceRecord): boolean {
  return (
    PRICE_CHECK_SOURCE_TYPES.has(source.sourceType) &&
    isHttpUrl(source.sourceUrl)
  );
}

function skipForSource(
  source: PropertySourceRecord,
  watchListItemId: string,
): ScheduledPriceCheckSkippedSource | null {
  if (!PRICE_CHECK_SOURCE_TYPES.has(source.sourceType)) {
    return {
      propertyId: source.propertyId,
      watchListItemId,
      sourceId: source.id,
      reason: "UNSUPPORTED_SOURCE_TYPE",
      message: `${source.sourceType} sources are not used for price checks.`,
    };
  }
  if (!source.sourceUrl) {
    return {
      propertyId: source.propertyId,
      watchListItemId,
      sourceId: source.id,
      reason: "NO_SOURCE_URL",
      message: "Source has no URL.",
    };
  }
  if (!isHttpUrl(source.sourceUrl)) {
    return {
      propertyId: source.propertyId,
      watchListItemId,
      sourceId: source.id,
      reason: "INVALID_URL",
      message: "Source URL must use http or https.",
    };
  }
  return null;
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

function summarizeResults(results: ScheduledPriceCheckResult[]): {
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
} {
  return {
    sourcesSucceeded: results.filter((result) => result.status === "SUCCEEDED")
      .length,
    sourcesFailed: results.filter((result) => result.status === "FAILED")
      .length,
    sourcesNeedsReview: results.filter((result) => isNeedsReviewResult(result))
      .length,
  };
}

function priceCheckRunStatus(
  results: ScheduledPriceCheckResult[],
  sourcesSelected: number,
): PriceCheckRunStatus {
  if (sourcesSelected === 0) return "SUCCEEDED";
  if (results.every((result) => result.status === "FAILED")) return "FAILED";
  if (results.every((result) => result.status === "SUCCEEDED"))
    return "SUCCEEDED";
  return "PARTIAL";
}

function latestResultBySource(
  results: PriceCheckRunResultRecord[],
  sourceIds: Set<string>,
): Map<string, PriceCheckRunResultRecord> {
  const latest = new Map<string, PriceCheckRunResultRecord>();
  for (const result of results) {
    if (!result.sourceId || !sourceIds.has(result.sourceId)) continue;
    const existing = latest.get(result.sourceId);
    if (
      !existing ||
      result.createdAt.getTime() > existing.createdAt.getTime()
    ) {
      latest.set(result.sourceId, result);
    }
  }
  return latest;
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

function startedWithinCooldown(
  startedAt: Date,
  cooldownMinutes: number,
): boolean {
  return Date.now() - startedAt.getTime() < cooldownMinutes * MINUTE_MS;
}

function setLatest(
  latest: Map<string, Date>,
  sourceId: string,
  checkedAt: Date,
): void {
  const existing = latest.get(sourceId);
  if (!existing || checkedAt.getTime() > existing.getTime()) {
    latest.set(sourceId, checkedAt);
  }
}
