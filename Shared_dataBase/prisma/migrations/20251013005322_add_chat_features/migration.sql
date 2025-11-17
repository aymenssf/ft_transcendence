-- CreateTable
CREATE TABLE "GameInvitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "chatRoomId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gameRoomId" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "GameInvitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameInvitation_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameInvitation_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'match',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" INTEGER NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("chatRoomId", "content", "created_at", "id", "senderId") SELECT "chatRoomId", "content", "created_at", "id", "senderId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_chatRoomId_idx" ON "ChatMessage"("chatRoomId");
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
CREATE INDEX "ChatMessage_created_at_idx" ON "ChatMessage"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GameInvitation_senderId_idx" ON "GameInvitation"("senderId");

-- CreateIndex
CREATE INDEX "GameInvitation_receiverId_idx" ON "GameInvitation"("receiverId");

-- CreateIndex
CREATE INDEX "GameInvitation_status_idx" ON "GameInvitation"("status");

-- CreateIndex
CREATE INDEX "GameInvitation_created_at_idx" ON "GameInvitation"("created_at");

-- CreateIndex
CREATE INDEX "TournamentNotification_userId_idx" ON "TournamentNotification"("userId");

-- CreateIndex
CREATE INDEX "TournamentNotification_tournamentId_idx" ON "TournamentNotification"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentNotification_isRead_idx" ON "TournamentNotification"("isRead");

-- CreateIndex
CREATE INDEX "TournamentNotification_created_at_idx" ON "TournamentNotification"("created_at");
