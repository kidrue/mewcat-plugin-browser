-- AlterTable
ALTER TABLE "TranslationRequest" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "TranslationRequest" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "TranslationRequest" ADD COLUMN "model" TEXT;
ALTER TABLE "TranslationRequest" ADD COLUMN "segmentCount" INTEGER;
ALTER TABLE "TranslationRequest" ADD COLUMN "sourceLanguage" TEXT;
ALTER TABLE "TranslationRequest" ADD COLUMN "targetLanguage" TEXT;
ALTER TABLE "TranslationRequest" ADD COLUMN "upstreamDurationMs" REAL;

-- CreateTable
CREATE TABLE "ApiCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "errorCode" TEXT,
    "durationMs" REAL NOT NULL,
    "translationRequestId" TEXT
);

-- CreateTable
CREATE TABLE "TranslationContent" (
    "requestId" TEXT NOT NULL PRIMARY KEY,
    "original" TEXT NOT NULL,
    "translated" TEXT,
    "digest" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "TranslationContent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TranslationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsIdentity" (
    "clientId" TEXT NOT NULL PRIMARY KEY,
    "epoch" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "requestCreatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sampledCharacters" INTEGER NOT NULL,
    "originalCharacters" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "clientId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "requests" BIGINT NOT NULL DEFAULT 0,
    "successes" BIGINT NOT NULL DEFAULT 0,
    "failures" BIGINT NOT NULL DEFAULT 0,
    "rejected" BIGINT NOT NULL DEFAULT 0,
    "executions" BIGINT NOT NULL DEFAULT 0,
    "characters" BIGINT NOT NULL DEFAULT 0,
    "promptTokens" BIGINT NOT NULL DEFAULT 0,
    "completionTokens" BIGINT NOT NULL DEFAULT 0,
    "durationMs" REAL NOT NULL DEFAULT 0,

    PRIMARY KEY ("clientId", "day", "dimension", "value")
);

-- CreateTable
CREATE TABLE "TopicDaily" (
    "clientId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "samples" BIGINT NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,

    PRIMARY KEY ("clientId", "day", "version", "topic")
);

-- CreateTable
CREATE TABLE "TopicSample" (
    "clientId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "digest" TEXT NOT NULL,

    PRIMARY KEY ("clientId", "day", "version", "digest")
);

-- CreateIndex
CREATE INDEX "ApiCall_createdAt_id_idx" ON "ApiCall"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ApiCall_clientId_createdAt_id_idx" ON "ApiCall"("clientId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TranslationContent_expiresAt_idx" ON "TranslationContent"("expiresAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_nextAttemptAt_leaseExpiresAt_idx" ON "AnalysisJob"("status", "nextAttemptAt", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_clientId_idx" ON "AnalysisJob"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisJob_requestId_version_key" ON "AnalysisJob"("requestId", "version");

-- CreateIndex
CREATE INDEX "ContentAnalysis_clientId_createdAt_idx" ON "ContentAnalysis"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentAnalysis_createdAt_idx" ON "ContentAnalysis"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAnalysis_requestId_version_key" ON "ContentAnalysis"("requestId", "version");

-- CreateIndex
CREATE INDEX "AnalyticsDaily_day_dimension_idx" ON "AnalyticsDaily"("day", "dimension");

-- CreateIndex
CREATE INDEX "TopicDaily_day_idx" ON "TopicDaily"("day");

-- CreateIndex
CREATE INDEX "TopicSample_day_idx" ON "TopicSample"("day");
