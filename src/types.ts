export const sourceTypes = [
  "MANUAL",
  "OFFICIAL_SITE",
  "FLOORPLAN_URL",
  "ZILLOW",
  "APARTMENTS_COM",
  "GOOGLE_MAPS",
  "REDFIN",
  "OTHER",
] as const;

export const watchPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
export const watchStatuses = [
  "WATCHING",
  "CONTACTED",
  "TOURED",
  "APPLIED",
  "REJECTED",
  "ARCHIVED",
  "LEASED",
] as const;
export const intakeInputTypes = [
  "OFFICIAL_WEBSITE_URL",
  "FLOORPLAN_URL",
  "ZILLOW_URL",
  "APARTMENTS_COM_URL",
  "GOOGLE_MAPS_URL",
  "PROPERTY_NAME",
  "ADDRESS",
  "FREE_TEXT",
] as const;
export const parsedStatuses = [
  "PENDING",
  "PARSED",
  "FAILED",
  "NEEDS_REVIEW",
] as const;
export const scrapeTaskTypes = [
  "PRICE_CHECK",
  "SOURCE_DISCOVERY",
  "REVIEW_CHECK",
  "SOCIAL_SEARCH",
  "AI_EXTRACTION",
] as const;
export const scrapeTaskStatuses = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;
export const crawlerTiers = [
  "API",
  "HTTP",
  "DIRECT_JSON",
  "BROWSER",
  "AI_EXTRACTION",
  "MANUAL",
] as const;
export const scrapeRunStatuses = ["SUCCEEDED", "FAILED", "PARTIAL"] as const;
export const priceCheckRunStatuses = [
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
] as const;
export const alertTypes = [
  "PRICE_DROPPED",
  "PRICE_INCREASED",
  "NEW_SPECIAL_OFFER",
  "SPECIAL_OFFER_CHANGED",
  "BECAME_AVAILABLE",
  "ENTERED_BUDGET",
  "SCRAPE_FAILED",
  "NEEDS_REVIEW",
] as const;
export const alertSeverities = ["INFO", "WARNING", "CRITICAL"] as const;

export type SourceType = (typeof sourceTypes)[number];
export type WatchPriority = (typeof watchPriorities)[number];
export type WatchStatus = (typeof watchStatuses)[number];
export type IntakeInputType = (typeof intakeInputTypes)[number];
export type ParsedStatus = (typeof parsedStatuses)[number];
export type ScrapeTaskType = (typeof scrapeTaskTypes)[number];
export type ScrapeTaskStatus = (typeof scrapeTaskStatuses)[number];
export type CrawlerTier = (typeof crawlerTiers)[number];
export type ScrapeRunStatus = (typeof scrapeRunStatuses)[number];
export type PriceCheckRunStatus = (typeof priceCheckRunStatuses)[number];
export type AlertType = (typeof alertTypes)[number];
export type AlertSeverity = (typeof alertSeverities)[number];

export type JsonData = unknown;

export interface PropertyRecord {
  id: string;
  name: string;
  normalizedName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  officialWebsite: string | null;
  propertyType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertySourceRecord {
  id: string;
  propertyId: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceExternalId: string | null;
  isPrimary: boolean;
  metadata: JsonData | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchListRecord {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchListItemRecord {
  id: string;
  watchListId: string;
  propertyId: string;
  targetBedrooms: number | null;
  targetBathrooms: number | null;
  targetMoveInDate: Date | null;
  targetBudgetMin: number | null;
  targetBudgetMax: number | null;
  priority: WatchPriority;
  notes: string | null;
  status: WatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchIntakeRecord {
  id: string;
  inputType: IntakeInputType;
  inputValue: string;
  parsedStatus: ParsedStatus;
  matchedPropertyId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceSnapshotRecord {
  id: string;
  propertyId: string;
  sourceId: string | null;
  floorplanName?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  baseRent?: number | null;
  effectiveRent?: number | null;
  leaseTermMonths?: number | null;
  moveInDate?: Date | null;
  specialOfferText?: string | null;
  specialOfferValue?: number | null;
  mandatoryFees?: number | null;
  availabilityStatus?: string | null;
  scrapedAt?: Date | null;
  rawData?: JsonData | null;
  parseStatus?: string;
  errorMessage?: string | null;
  createdAt: Date;
}

export interface ScrapeTaskRecord {
  id: string;
  propertyId: string | null;
  sourceId: string | null;
  taskType: ScrapeTaskType;
  priority: WatchPriority;
  status: ScrapeTaskStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  crawlerTier: CrawlerTier;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapeRunRecord {
  id: string;
  taskId: string | null;
  propertyId: string | null;
  sourceId: string | null;
  crawlerTier: CrawlerTier;
  status: ScrapeRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  httpStatus: number | null;
  contentHash: string | null;
  itemsFound: number | null;
  rawStorageUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface RawPageRecord {
  id: string;
  scrapeRunId: string | null;
  propertyId: string | null;
  sourceId: string | null;
  url: string;
  contentType: string | null;
  contentHash: string | null;
  rawText: string | null;
  rawJson: JsonData | null;
  rawHtmlStorageUrl: string | null;
  createdAt: Date;
}

export interface PriceCheckRunRecord {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: PriceCheckRunStatus;
  watchItemsScanned: number;
  sourcesSelected: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesNeedsReview: number;
  createdAt: Date;
}

export interface PriceCheckRunResultRecord {
  id: string;
  priceCheckRunId: string;
  propertyId: string | null;
  sourceId: string | null;
  scrapeRunId: string | null;
  status: string;
  crawlerTier: string | null;
  itemsFound: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AlertRecord {
  id: string;
  propertyId: string | null;
  watchListItemId: string | null;
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  isRead: boolean;
  createdAt: Date;
}

export interface Repository {
  createProperty(
    data: Partial<PropertyRecord> & { name: string },
  ): Promise<PropertyRecord>;
  listProperties(): Promise<PropertyRecord[]>;
  getProperty(id: string): Promise<PropertyRecord | null>;
  updateProperty(
    id: string,
    data: Partial<PropertyRecord>,
  ): Promise<PropertyRecord | null>;
  deleteProperty(id: string): Promise<boolean>;
  createPropertySource(
    data: Omit<PropertySourceRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<PropertySourceRecord | null>;
  getPropertySource(id: string): Promise<PropertySourceRecord | null>;
  listPropertySources(propertyId: string): Promise<PropertySourceRecord[]>;
  updatePropertySource(
    id: string,
    data: Partial<PropertySourceRecord>,
  ): Promise<PropertySourceRecord | null>;
  deletePropertySource(sourceId: string): Promise<boolean>;
  listWatchLists(): Promise<WatchListRecord[]>;
  createWatchList(data: {
    name: string;
    description?: string | null;
  }): Promise<WatchListRecord>;
  getWatchList(id: string): Promise<WatchListRecord | null>;
  getOrCreateDefaultWatchList(): Promise<WatchListRecord>;
  createWatchListItem(
    data: Omit<WatchListItemRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchListItemRecord>;
  listWatchListItems(): Promise<WatchListItemRecord[]>;
  getWatchListItem(id: string): Promise<WatchListItemRecord | null>;
  updateWatchListItem(
    id: string,
    data: Partial<WatchListItemRecord>,
  ): Promise<WatchListItemRecord | null>;
  deleteWatchListItem(id: string): Promise<boolean>;
  createWatchIntake(
    data: Omit<WatchIntakeRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WatchIntakeRecord>;
  listWatchIntakes(): Promise<WatchIntakeRecord[]>;
  getWatchIntake(id: string): Promise<WatchIntakeRecord | null>;
  listPriceSnapshots(propertyId: string): Promise<PriceSnapshotRecord[]>;
  listPriceHistory(propertyId: string): Promise<PriceSnapshotRecord[]>;
  getLatestPriceSnapshot(
    propertyId: string,
  ): Promise<PriceSnapshotRecord | null>;
  createPriceSnapshot(
    data: Omit<PriceSnapshotRecord, "id" | "createdAt">,
  ): Promise<PriceSnapshotRecord>;
  createScrapeTask(
    data: Omit<ScrapeTaskRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ScrapeTaskRecord | null>;
  listScrapeTasks(): Promise<ScrapeTaskRecord[]>;
  getScrapeTask(id: string): Promise<ScrapeTaskRecord | null>;
  updateScrapeTask(
    id: string,
    data: Partial<ScrapeTaskRecord>,
  ): Promise<ScrapeTaskRecord | null>;
  createScrapeRun(
    data: Omit<ScrapeRunRecord, "id" | "createdAt">,
  ): Promise<ScrapeRunRecord>;
  listScrapeRuns(): Promise<ScrapeRunRecord[]>;
  getScrapeRun(id: string): Promise<ScrapeRunRecord | null>;
  updateScrapeRun(
    id: string,
    data: Partial<ScrapeRunRecord>,
  ): Promise<ScrapeRunRecord | null>;
  createRawPage(
    data: Omit<RawPageRecord, "id" | "createdAt">,
  ): Promise<RawPageRecord>;
  createPriceCheckRun(
    data: Omit<PriceCheckRunRecord, "id" | "createdAt">,
  ): Promise<PriceCheckRunRecord>;
  updatePriceCheckRun(
    id: string,
    data: Partial<PriceCheckRunRecord>,
  ): Promise<PriceCheckRunRecord | null>;
  listPriceCheckRuns(filters?: {
    limit?: number;
    status?: PriceCheckRunStatus;
  }): Promise<PriceCheckRunRecord[]>;
  getPriceCheckRun(id: string): Promise<PriceCheckRunRecord | null>;
  createPriceCheckRunResult(
    data: Omit<PriceCheckRunResultRecord, "id" | "createdAt">,
  ): Promise<PriceCheckRunResultRecord>;
  listPriceCheckRunResults(
    priceCheckRunId?: string,
  ): Promise<PriceCheckRunResultRecord[]>;
  listAlerts(filters?: {
    isRead?: boolean;
    propertyId?: string;
    alertType?: AlertType;
  }): Promise<AlertRecord[]>;
  createAlert(
    data: Omit<AlertRecord, "id" | "createdAt" | "isRead"> & {
      isRead?: boolean;
    },
  ): Promise<AlertRecord>;
  createAlertForTest?(
    data: Omit<AlertRecord, "id" | "createdAt">,
  ): Promise<AlertRecord>;
  markAlertRead(id: string): Promise<AlertRecord | null>;
}
