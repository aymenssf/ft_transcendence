/*
  Warnings:

  - The primary key for the `BlockedUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `BlockedUser` table. All the data in the column will be lost.
  - The primary key for the `MembersOnChatRooms` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlockedUser" (
    "blockerId" INTEGER NOT NULL,
    "blockedId" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("blockerId", "blockedId"),
    CONSTRAINT "BlockedUser_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlockedUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BlockedUser" ("blockedId", "blockerId", "created_at") SELECT "blockedId", "blockerId", "created_at" FROM "BlockedUser";
DROP TABLE "BlockedUser";
ALTER TABLE "new_BlockedUser" RENAME TO "BlockedUser";
CREATE INDEX "BlockedUser_blockerId_idx" ON "BlockedUser"("blockerId");
CREATE INDEX "BlockedUser_blockedId_idx" ON "BlockedUser"("blockedId");
CREATE TABLE "new_MembersOnChatRooms" (
    "userId" INTEGER NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'member',

    PRIMARY KEY ("chatRoomId", "userId"),
    CONSTRAINT "MembersOnChatRooms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembersOnChatRooms_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MembersOnChatRooms" ("chatRoomId", "joinedAt", "role", "userId") SELECT "chatRoomId", "joinedAt", "role", "userId" FROM "MembersOnChatRooms";
DROP TABLE "MembersOnChatRooms";
ALTER TABLE "new_MembersOnChatRooms" RENAME TO "MembersOnChatRooms";
CREATE INDEX "MembersOnChatRooms_userId_idx" ON "MembersOnChatRooms"("userId");
CREATE INDEX "MembersOnChatRooms_chatRoomId_idx" ON "MembersOnChatRooms"("chatRoomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
