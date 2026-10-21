-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "signingKey" TEXT NOT NULL,
    "encryptionKey" TEXT NOT NULL,
    "keyThumbprint" TEXT NOT NULL,
    "registrationTokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Invitation" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Nonce" (
    "clientId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,

    PRIMARY KEY ("clientId", "value"),
    CONSTRAINT "Nonce_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TranslationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputCharacters" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    CONSTRAINT "TranslationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_keyThumbprint_key" ON "Client"("keyThumbprint");

-- CreateIndex
CREATE UNIQUE INDEX "Client_registrationTokenHash_key" ON "Client"("registrationTokenHash");

-- CreateIndex
CREATE INDEX "Nonce_expiresAt_idx" ON "Nonce"("expiresAt");

-- CreateIndex
CREATE INDEX "UsageBucket_expiresAt_idx" ON "UsageBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "TranslationRequest_createdAt_idx" ON "TranslationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "TranslationRequest_clientId_createdAt_idx" ON "TranslationRequest"("clientId", "createdAt");
