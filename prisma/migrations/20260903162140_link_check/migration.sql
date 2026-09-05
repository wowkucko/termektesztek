-- CreateTable
CREATE TABLE "LinkCheckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "oldUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "alive" BOOLEAN,
    "newUrl" TEXT,
    "reason" TEXT,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LinkCheckState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "running" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitUntil" DATETIME,
    "lastRunAt" DATETIME,
    "currentItemId" TEXT,
    "log" TEXT NOT NULL DEFAULT '',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "replacedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "LinkCheckItem_status_createdAt_idx" ON "LinkCheckItem"("status", "createdAt");
