-- CreateTable
CREATE TABLE "UnreadMessage" (
    "userId" INTEGER NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageId" INTEGER,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "chatRoomId"),
    CONSTRAINT "UnreadMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnreadMessage_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "avatar" TEXT,
    "is_42_user" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT,
    "googleId" TEXT
);
INSERT INTO "new_User" ("avatar", "created_at", "email", "googleId", "id", "is_42_user", "password", "provider", "username") SELECT "avatar", "created_at", "email", "googleId", "id", "is_42_user", "password", "provider", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UnreadMessage_userId_idx" ON "UnreadMessage"("userId");

-- CreateIndex
CREATE INDEX "UnreadMessage_chatRoomId_idx" ON "UnreadMessage"("chatRoomId");
