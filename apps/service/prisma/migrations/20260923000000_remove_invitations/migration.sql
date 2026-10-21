PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "signingKey" TEXT NOT NULL,
    "encryptionKey" TEXT NOT NULL,
    "keyThumbprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

INSERT INTO "new_Client" ("id", "name", "signingKey", "encryptionKey", "keyThumbprint", "createdAt", "revokedAt")
SELECT "id", "name", "signingKey", "encryptionKey", "keyThumbprint", "createdAt", "revokedAt" FROM "Client";

DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_keyThumbprint_key" ON "Client"("keyThumbprint");
DROP TABLE "Invitation";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
