-- AlterTable
ALTER TABLE "LinkCheckState" ADD COLUMN "nextRunAt" DATETIME;
ALTER TABLE "LinkCheckState" ADD COLUMN "scheduleEnabled" BOOLEAN;
