-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" TEXT NOT NULL,
    "p1" TEXT,
    "p2" TEXT,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT,
    "winner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_gameId_key" ON "Match"("gameId");
