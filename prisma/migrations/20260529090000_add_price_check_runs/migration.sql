-- CreateEnum
CREATE TYPE "PriceCheckRunStatus" AS ENUM ('SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "PriceCheckRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" "PriceCheckRunStatus" NOT NULL,
    "watchItemsScanned" INTEGER NOT NULL,
    "sourcesSelected" INTEGER NOT NULL,
    "sourcesSucceeded" INTEGER NOT NULL,
    "sourcesFailed" INTEGER NOT NULL,
    "sourcesNeedsReview" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCheckRunResult" (
    "id" TEXT NOT NULL,
    "priceCheckRunId" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceId" TEXT,
    "scrapeRunId" TEXT,
    "status" TEXT NOT NULL,
    "crawlerTier" TEXT,
    "itemsFound" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCheckRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceCheckRun_status_startedAt_idx" ON "PriceCheckRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "PriceCheckRun_createdAt_idx" ON "PriceCheckRun"("createdAt");

-- CreateIndex
CREATE INDEX "PriceCheckRunResult_priceCheckRunId_idx" ON "PriceCheckRunResult"("priceCheckRunId");

-- CreateIndex
CREATE INDEX "PriceCheckRunResult_sourceId_idx" ON "PriceCheckRunResult"("sourceId");

-- CreateIndex
CREATE INDEX "PriceCheckRunResult_scrapeRunId_idx" ON "PriceCheckRunResult"("scrapeRunId");

-- AddForeignKey
ALTER TABLE "PriceCheckRunResult" ADD CONSTRAINT "PriceCheckRunResult_priceCheckRunId_fkey" FOREIGN KEY ("priceCheckRunId") REFERENCES "PriceCheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
