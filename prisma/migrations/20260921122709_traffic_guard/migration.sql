-- CreateTable
CREATE TABLE "TrafficGuard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TrafficGuard_key_key" ON "TrafficGuard"("key");

-- CreateIndex
CREATE INDEX "TrafficGuard_expiresAt_idx" ON "TrafficGuard"("expiresAt");
