-- CreateTable
CREATE TABLE "GeminiKeyState" (
    "keyHash" TEXT NOT NULL PRIMARY KEY,
    "cooldownUntil" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
