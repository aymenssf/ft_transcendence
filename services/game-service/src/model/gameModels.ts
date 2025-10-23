// src/gameModels.ts
import { PrismaClient } from '@prisma/client'
import { GameRoom } from '../utils/types.js'

const prisma = new PrismaClient()

export const GameModel = {
    async getAllMatches() {
        return await prisma.match.findMany()
    },

    async getMatchById(id: number) {
        return await prisma.match.findUnique({ where: { id } })
    },

    async createMatch(player1: string, player2: string, winner?: string) {
        return await prisma.match.create({
            data: { player1, player2, winner },
        })
    },

    async deleteMatch(id: number) {
        return await prisma.match.delete({ where: { id } })
    },
}


export async function saveGameRoom(gameRoom: GameRoom) {
    return await prisma.gameRoom.upsert({
        where: { gameId: gameRoom.gameId },
        update: {
            p1: gameRoom.p1,
            p2: gameRoom.p2,
            status: gameRoom.status,
            mode: gameRoom.mode,
            difficulty: gameRoom.difficulty,
            winner: gameRoom.winner,
        },
        create: {
            gameId: gameRoom.gameId,
            p1: gameRoom.p1,
            p2: gameRoom.p2,
            status: gameRoom.status,
            mode: gameRoom.mode,
            difficulty: gameRoom.difficulty,
            winner: gameRoom.winner,
        },
    })
}
