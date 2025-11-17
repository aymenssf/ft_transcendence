// src/gameModels.ts
import { PrismaClient } from '@prisma/client'
import { GameRoom } from '../utils/types.js'

const prisma = new PrismaClient()

export const GameModel = {
    async getAllMatches() {
        return await prisma.match.findMany()
    },

    async getMatchById(id: string) {
        return await prisma.match.findUnique({ where: { id } })
    },

    async createMatch(player1: string, player2: string, winner?: string) {
        return await prisma.match.create({
            data: { player1, player2, winner },
        })
    },

    async deleteMatch(id: string) {
        return await prisma.match.delete({ where: { id } })
    },

    async getUserMatches(id: string) {
        return await prisma.match.findMany({
            where: {
                OR: [
                    { p1: id },
                    { p2: id },
                ],
            },
            orderBy: {
                createdAt: 'desc'
            },
        });
    },

    async getUserStats(id: string) {
        const matches = await prisma.match.findMany({
            where: {
                OR: [{ p1: id }, { p2: id }],
            },
        });

        if (matches.length === 0) {
            return { total: 0, wins: 0, losses: 0, winRate: 0, avgScore: 0 };
        }

        let wins = 0;
        let totalScore = 0;
        let gamesPlayed = matches.length;

        for (const match of matches) {
            const isPlayer1 = match.player1 === id;
            const playerScore = isPlayer1 ? match.score1 : match.score2;
            const opponentScore = isPlayer1 ? match.score2 : match.score1;

            totalScore += playerScore;
            if (match.winner === id) wins++;
        }

        const losses = gamesPlayed - wins;
        const winRate = ((wins / gamesPlayed) * 100).toFixed(2);
        const avgScore = (totalScore / gamesPlayed).toFixed(2);

        return {
            total: gamesPlayed,
            wins,
            losses,
            winRate: Number(winRate),
            avgScore: Number(avgScore),
        };
    }

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
