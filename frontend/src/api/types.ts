export type PriceCheckHealth = {
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
  issues: Array<{ message: string; type: string }>;
};

export type OverviewItem = {
  watchItemId: string;
  propertyName?: string;
  watchItemStatus: string;
  latestPrice: {
    effectiveRent?: number | null;
    baseRent?: number | null;
  } | null;
  budgetStatus: {
    withinBudget: boolean | null;
    amountAboveBudget?: number | null;
    amountBelowBudget?: number | null;
  };
  alertSummary: { unreadCount: number };
  trackingStatus: { lastCheckedAt?: string | null; needsReview: boolean };
  sourceHealthStatus: {
    overallStatus: string;
    hasUsableSource: boolean;
    usableSources: number;
  };
};

export type OverviewResponse = {
  generatedAt: string;
  total: number;
  limit: number;
  offset: number;
  items: OverviewItem[];
};

export type PriceCheckRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  sourcesSelected: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
};

export type WatchItemDetail = {
  watchItemId: string;
  propertyName?: string;
  watchItemStatus: string;
  targetBudgetMax?: number | null;
  latestPrice: {
    baseRent?: number | null;
    effectiveRent?: number | null;
    floorplanName?: string | null;
    unitNumber?: string | null;
    availabilityStatus?: string | null;
    specialOfferText?: string | null;
    createdAt: string;
  } | null;
  alertSummary: {
    unreadCount: number;
    latestAlert?: { title: string; message: string; createdAt: string } | null;
  };
  trackingStatus: {
    lastCheckedAt?: string | null;
    lastSuccessfulCheckAt?: string | null;
    lastFailedCheckAt?: string | null;
    needsReview: boolean;
    lastErrorMessage?: string | null;
  };
  sourceHealth: Array<{
    sourceId: string;
    sourceType: string;
    sourceUrl?: string | null;
    isUsable: boolean;
    lastRunStatus?: string | null;
    needsReview: boolean;
    errorMessage?: string | null;
  }>;
  recentResults: Array<{
    status: string;
    crawlerTier?: string | null;
    itemsFound?: number | null;
    errorMessage?: string | null;
    createdAt: string;
  }>;
};

export type RunAllOptions = {
  dryRun: boolean;
  cooldownMinutes?: number;
  maxSources?: number;
  force: boolean;
};

export type RunOptionsFormState = {
  cooldownMinutes: string;
  maxSources: string;
  force: boolean;
};
