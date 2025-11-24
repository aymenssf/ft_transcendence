// src/gameModels.ts
import { GAME_ROOM_MODE } from '../helpers/consts.js'
import { GameRoom } from '../utils/types.js'
import prisma from "./prisma.js"

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
        // Debug info: what's prisma at runtime?
        console.error('DEBUG prisma exists:', !!prisma);
        try {
            console.error('DEBUG prisma keys:', Object.keys(prisma || {}));
        } catch (e) {
            console.error('DEBUG prisma keys read failed:', e);
        }
        console.error('DEBUG has match model:', prisma?.match !== undefined);

        if (!prisma) {
            throw new Error('Prisma client is undefined — check import path and that @prisma/client was generated.');
        }
        if (!('match' in prisma)) {
            throw new Error(
                'Prisma client does not expose model "match". Check prisma/schema.prisma for a model named "Match" (model names are transformed to lowerCamel model properties) and ensure `prisma generate` ran.'
            );
        }
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
            const isPlayer1 = match.p1 === id;
            const playerScore = isPlayer1 ? match.p1Score : match.p2Score;
            const opponentScore = isPlayer1 ? match.p2Score : match.p1Score;

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
    if (gameRoom?.mode === GAME_ROOM_MODE.LOCAL) return;
    return await prisma.match.upsert({
        where: { gameId: gameRoom.gameId },
        update: {
            p1: "" + gameRoom.p1,
            p2: "" + gameRoom.p2,
            status: gameRoom.status,
            mode: gameRoom.mode,
            p1Score: gameRoom.state.paddles.left.score,
            p2Score: gameRoom.state.paddles.right.score,
            difficulty: gameRoom.difficulty,
            winner: "" + gameRoom.winner,
        },
        create: {
            gameId: gameRoom.gameId,
            p1: "" + gameRoom.p1,
            p2: "" + gameRoom.p2,
            status: gameRoom.status,
            mode: gameRoom.mode,
            p1Score: gameRoom.state.paddles.left.score,
            p2Score: gameRoom.state.paddles.right.score,
            difficulty: gameRoom.difficulty,
            winner: "" + gameRoom.winner,
        },
    })
}
