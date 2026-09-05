-- CreateTable
CREATE TABLE "SyncProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "allegroUrl" TEXT,
    "allegroData" TEXT,
    "postId" TEXT,
    "postSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "running" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitUntil" DATETIME,
    "lastRunAt" DATETIME,
    "currentItemId" TEXT,
    "log" TEXT NOT NULL DEFAULT '',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SyncProduct_status_createdAt_idx" ON "SyncProduct"("status", "createdAt");
