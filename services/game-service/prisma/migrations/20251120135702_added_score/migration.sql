-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" TEXT NOT NULL,
    "p1" TEXT,
    "p2" TEXT,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT,
    "winner" TEXT,
    "p1Score" INTEGER NOT NULL DEFAULT 0,
    "p2Score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Match" ("createdAt", "difficulty", "gameId", "id", "mode", "p1", "p2", "status", "updatedAt", "winner") SELECT "createdAt", "difficulty", "gameId", "id", "mode", "p1", "p2", "status", "updatedAt", "winner" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE UNIQUE INDEX "Match_gameId_key" ON "Match"("gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
