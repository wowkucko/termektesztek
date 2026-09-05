-- CreateTable
CREATE TABLE "PushRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postSlug" TEXT NOT NULL,
    "remoteSlug" TEXT NOT NULL,
    "pushedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PushFile" (
    "localPath" TEXT NOT NULL PRIMARY KEY,
    "remoteUrl" TEXT NOT NULL,
    "pushedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PushRecord_postSlug_key" ON "PushRecord"("postSlug");
