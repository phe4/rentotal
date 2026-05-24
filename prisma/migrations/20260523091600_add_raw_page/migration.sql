-- CreateTable
CREATE TABLE "RawPage" (
    "id" TEXT NOT NULL,
    "scrapeRunId" TEXT,
    "propertyId" TEXT,
    "sourceId" TEXT,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "contentHash" TEXT,
    "rawText" TEXT,
    "rawJson" JSONB,
    "rawHtmlStorageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawPage_scrapeRunId_idx" ON "RawPage"("scrapeRunId");

-- CreateIndex
CREATE INDEX "RawPage_propertyId_idx" ON "RawPage"("propertyId");

-- CreateIndex
CREATE INDEX "RawPage_sourceId_idx" ON "RawPage"("sourceId");

-- CreateIndex
CREATE INDEX "RawPage_contentHash_idx" ON "RawPage"("contentHash");

-- AddForeignKey
ALTER TABLE "RawPage" ADD CONSTRAINT "RawPage_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "ScrapeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawPage" ADD CONSTRAINT "RawPage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawPage" ADD CONSTRAINT "RawPage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PropertySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
