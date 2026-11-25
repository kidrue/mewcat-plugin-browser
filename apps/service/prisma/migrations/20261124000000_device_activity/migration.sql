ALTER TABLE "Client" ADD COLUMN "activityRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "DeviceActivity" (
    "clientId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "installedAt" DATETIME,
    "uninstalledAt" DATETIME,
    "firstTranslationAt" DATETIME,
    "lastTranslationAt" DATETIME,
    "uninstallTokenHash" TEXT,
    CONSTRAINT "DeviceActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DeviceActivityPage" (
    "clientId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "pageKey" TEXT,
    PRIMARY KEY ("clientId", "eventId"),
    CONSTRAINT "DeviceActivityPage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "DeviceActivity" ("clientId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceActivity_uninstallTokenHash_key" ON "DeviceActivity"("uninstallTokenHash");
CREATE INDEX "DeviceActivity_installedAt_idx" ON "DeviceActivity"("installedAt");
CREATE INDEX "DeviceActivity_uninstalledAt_idx" ON "DeviceActivity"("uninstalledAt");
CREATE INDEX "DeviceActivity_firstTranslationAt_idx" ON "DeviceActivity"("firstTranslationAt");
CREATE UNIQUE INDEX "DeviceActivityPage_clientId_day_pageKey_key" ON "DeviceActivityPage"("clientId", "day", "pageKey");
CREATE INDEX "DeviceActivityPage_day_clientId_idx" ON "DeviceActivityPage"("day", "clientId");
