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

export type SourceType = (typeof sourceTypes)[number];
export type WatchPriority = (typeof watchPriorities)[number];
export type WatchStatus = (typeof watchStatuses)[number];
export type IntakeInputType = (typeof intakeInputTypes)[number];
export type ParsedStatus = (typeof parsedStatuses)[number];

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
  createdAt: Date;
}

export interface AlertRecord {
  id: string;
  propertyId: string | null;
  watchListItemId: string | null;
  alertType: string;
  title: string;
  message: string;
  severity: string;
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
  listPropertySources(propertyId: string): Promise<PropertySourceRecord[]>;
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
  getLatestPriceSnapshot(
    propertyId: string,
  ): Promise<PriceSnapshotRecord | null>;
  listAlerts(): Promise<AlertRecord[]>;
  createAlertForTest?(
    data: Omit<AlertRecord, "id" | "createdAt">,
  ): Promise<AlertRecord>;
  markAlertRead(id: string): Promise<AlertRecord | null>;
}
