-- CreateEnum
CREATE TYPE "PropertySourceType" AS ENUM ('MANUAL', 'OFFICIAL_SITE', 'FLOORPLAN_URL', 'ZILLOW', 'APARTMENTS_COM', 'GOOGLE_MAPS', 'REDFIN', 'OTHER');

-- CreateEnum
CREATE TYPE "WatchItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "WatchItemStatus" AS ENUM ('WATCHING', 'CONTACTED', 'TOURED', 'APPLIED', 'REJECTED', 'ARCHIVED', 'LEASED');

-- CreateEnum
CREATE TYPE "WatchIntakeInputType" AS ENUM ('OFFICIAL_WEBSITE_URL', 'FLOORPLAN_URL', 'ZILLOW_URL', 'APARTMENTS_COM_URL', 'GOOGLE_MAPS_URL', 'PROPERTY_NAME', 'ADDRESS', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "ParsedStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "PriceParseStatus" AS ENUM ('NOT_PARSED', 'PARSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ScrapeTaskType" AS ENUM ('PRICE_CHECK', 'SOURCE_DISCOVERY', 'REVIEW_CHECK', 'SOCIAL_SEARCH', 'AI_EXTRACTION');

-- CreateEnum
CREATE TYPE "ScrapeTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrawlerTier" AS ENUM ('API', 'HTTP', 'DIRECT_JSON', 'BROWSER', 'AI_EXTRACTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_DROPPED', 'PRICE_INCREASED', 'NEW_SPECIAL_OFFER', 'SPECIAL_OFFER_CHANGED', 'BECAME_AVAILABLE', 'ENTERED_BUDGET', 'SCRAPE_FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('REVIEW', 'SOCIAL_POST', 'OFFICIAL_SITE_TEXT', 'SPECIAL_OFFER_TEXT', 'AGENT_FINDING', 'LEASE_TERM', 'FAQ', 'SCRAPED_PAGE', 'USER_NOTE');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "officialWebsite" TEXT,
    "propertyType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySource" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sourceType" "PropertySourceType" NOT NULL,
    "sourceUrl" TEXT,
    "sourceExternalId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchListItem" (
    "id" TEXT NOT NULL,
    "watchListId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "targetBedrooms" INTEGER,
    "targetBathrooms" DOUBLE PRECISION,
    "targetMoveInDate" TIMESTAMP(3),
    "targetBudgetMin" INTEGER,
    "targetBudgetMax" INTEGER,
    "priority" "WatchItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "status" "WatchItemStatus" NOT NULL DEFAULT 'WATCHING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchIntake" (
    "id" TEXT NOT NULL,
    "inputType" "WatchIntakeInputType" NOT NULL,
    "inputValue" TEXT NOT NULL,
    "parsedStatus" "ParsedStatus" NOT NULL DEFAULT 'PENDING',
    "matchedPropertyId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sourceId" TEXT,
    "floorplanName" TEXT,
    "unitNumber" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "sqft" INTEGER,
    "baseRent" INTEGER,
    "effectiveRent" INTEGER,
    "leaseTermMonths" INTEGER,
    "moveInDate" TIMESTAMP(3),
    "specialOfferText" TEXT,
    "specialOfferValue" INTEGER,
    "mandatoryFees" INTEGER,
    "availabilityStatus" TEXT,
    "scrapedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "parseStatus" "PriceParseStatus" NOT NULL DEFAULT 'NOT_PARSED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeTask" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceId" TEXT,
    "taskType" "ScrapeTaskType" NOT NULL,
    "priority" "WatchItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ScrapeTaskStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "crawlerTier" "CrawlerTier" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "propertyId" TEXT,
    "sourceId" TEXT,
    "crawlerTier" "CrawlerTier" NOT NULL,
    "status" "ScrapeRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "itemsFound" INTEGER,
    "rawStorageUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "watchListItemId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "language" TEXT,
    "collectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "propertyId" TEXT,
    "chunkText" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertySource_propertyId_idx" ON "PropertySource"("propertyId");

-- CreateIndex
CREATE INDEX "WatchListItem_propertyId_idx" ON "WatchListItem"("propertyId");

-- CreateIndex
CREATE INDEX "WatchListItem_watchListId_idx" ON "WatchListItem"("watchListId");

-- CreateIndex
CREATE INDEX "WatchIntake_matchedPropertyId_idx" ON "WatchIntake"("matchedPropertyId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_propertyId_createdAt_idx" ON "PriceSnapshot"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_sourceId_idx" ON "PriceSnapshot"("sourceId");

-- CreateIndex
CREATE INDEX "ScrapeTask_propertyId_idx" ON "ScrapeTask"("propertyId");

-- CreateIndex
CREATE INDEX "ScrapeTask_sourceId_idx" ON "ScrapeTask"("sourceId");

-- CreateIndex
CREATE INDEX "ScrapeTask_status_scheduledAt_idx" ON "ScrapeTask"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_propertyId_idx" ON "ScrapeRun"("propertyId");

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceId_idx" ON "ScrapeRun"("sourceId");

-- CreateIndex
CREATE INDEX "ScrapeRun_taskId_idx" ON "ScrapeRun"("taskId");

-- CreateIndex
CREATE INDEX "Alert_propertyId_idx" ON "Alert"("propertyId");

-- CreateIndex
CREATE INDEX "Alert_watchListItemId_idx" ON "Alert"("watchListItemId");

-- CreateIndex
CREATE INDEX "Alert_isRead_createdAt_idx" ON "Alert"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_chunkIndex_idx" ON "DocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "DocumentChunk_propertyId_idx" ON "DocumentChunk"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertySource" ADD CONSTRAINT "PropertySource_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchListItem" ADD CONSTRAINT "WatchListItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchListItem" ADD CONSTRAINT "WatchListItem_watchListId_fkey" FOREIGN KEY ("watchListId") REFERENCES "WatchList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchIntake" ADD CONSTRAINT "WatchIntake_matchedPropertyId_fkey" FOREIGN KEY ("matchedPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PropertySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeTask" ADD CONSTRAINT "ScrapeTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeTask" ADD CONSTRAINT "ScrapeTask_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PropertySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PropertySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ScrapeTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_watchListItemId_fkey" FOREIGN KEY ("watchListItemId") REFERENCES "WatchListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
