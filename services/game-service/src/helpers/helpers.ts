import { games, tournaments } from "../utils/store.js";
import { randomUUID } from 'crypto';
import { BALL_START, CANVAS_HEIGHT, CANVAS_WIDTH, BALL_SPEED, PADDLE_HEIGHT, PADDLE_WIDTH, GAME_ROOM_STATUS, GAME_ROOM_MODE } from "./consts.js";
import { GameMode, GameRoom, GameState } from "../utils/types.js";
import { SocketStream } from "@fastify/websocket";
import { WebSocket } from "ws";
import { startGame } from "../game/gameLoop.js";

export function findGameRoomByPlayer(playerId: string): GameRoom | null {
    for (const room of games.values()) {
        if (room.p1 === playerId || room.p2 === playerId)
            return room;
    }
    return null;
}

export function isPlaying(playerId: string): boolean {
    for (const room of games.values()) {
        if ((room.p1 === playerId || room.p2 === playerId) && room.status === "ongoing")
            return true;
    }
    return false;
}


export function playerInOtherRoom(playerId: string, roomId: string): boolean {
    if (findGameRoomByPlayer(playerId) == null)
        return false;

    for (const room of games.values()) {
        if (room.gameId !== roomId && (room.p1 === playerId || room.p2 === playerId))
            return true;
    }

    return false;
}

export function getTournamentByRoomId(gameId: string) {
    for (const tourn of tournaments.values()) {
        for (const round of tourn.rounds) {
            if (round.gameId === gameId) {
                return tourn;
            }
        }
    }
    return null;
}


// export function assertRoomConsistency(room) {
//     if (!room.gameId) throw new Error("missing gameId");
//     if (room.status === "ongoing" && room.loop == null) throw new Error("ongoing but no loop");
//     if (room.status !== "ongoing" && room.loop != null) throw new Error("loop running when not ongoing");
//     if (room.p2 === null && room.mode !== "local" && room.status === "ongoing")
//         throw new Error("ongoing without p2");
// }
interface GameConfig {
    type: string;
    payload: {
        gameId: string;
        mode: GameMode;
        difficulty: string;
        canvas: {
            width: number;
            height: number;
            color?: string;
        }
        paddle: {
            width: number;
            height: number;
            color?: string;
        }
        paddles: {
            left: { x: number, y: number };
            right: { x: number, y: number };
        }
        ball: {
            radius: number;
            x: number;
            y: number;
            color?: string
        };
    }
}
export function createInitialGameState(gameId: string, mode: GameMode, difficulty = "easy"): GameConfig {
    return {
        type: "game_config",
        payload: {
            gameId,
            mode,
            difficulty: difficulty,
            canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: "#38D8FD" },
            paddle: { width: PADDLE_WIDTH, height: PADDLE_HEIGHT, color: "#0F28CA" },
            paddles: {
                left: { x: 15, y: CANVAS_HEIGHT / 2 - 75 },
                right: { x: 875, y: CANVAS_HEIGHT / 2 - 75 }
            },
            ball: { radius: 10, x: BALL_START.x, y: BALL_START.y, color: "yellow" }
        }
    };
}

export function findSocketForPlayer(room: GameRoom, playerId: string): WebSocket | undefined {
    if (playerId === room.p1) return Array.from(room.sockets)[0];
    if (playerId === room.p2) return Array.from(room.sockets)[1];
    return undefined;
}

export function createGameRoom(player1: string | null, player2: string | null, player1_socket: WebSocket | undefined, mode: GameMode = GAME_ROOM_MODE.RANDOM): GameRoom {

    const gameId = randomUUID();
    const sockets = new Set<WebSocket>();
    if (player1_socket) sockets.add(player1_socket);
    const gameRoom: GameRoom = {
        gameId,
        p1: player1,
        p2: player2,
        status: GAME_ROOM_STATUS.WAITING,
        mode: mode,
        sockets,
        loop: null,
        state: {
            canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
            paddles: {
                left: { x: 15, y: CANVAS_HEIGHT / 2 - 75, up: false, down: false, score: 0 },
                right: { x: 875, y: CANVAS_HEIGHT / 2 - 75, up: false, down: false, score: 0 },
                width: PADDLE_WIDTH, height: PADDLE_HEIGHT
            },
            ball: { radius: 10, x: BALL_START.x, y: BALL_START.x, dx: BALL_SPEED, dy: -BALL_SPEED }
        },
        readyPlayers: new Set(),
        winner: null

    };
    games.set(gameId, gameRoom);

    return gameRoom;

}
export function handlePlayerReady(connection: SocketStream, playerId: string, gameId: string) {
    const game = games.get(gameId);
    if (!game) {
        console.warn(`[handlePlayerReady] Game not found: ${gameId}`);
        return;
    }

    if (game.p1 !== playerId && game.p2 !== playerId) {
        console.warn(`[handlePlayerReady] Player ${playerId} not part of game ${gameId}`);
        return;
    }

    if (game.readyPlayers.has(playerId)) return;

    game.readyPlayers.add(playerId);

    for (const s of game.sockets) {
        s?.send(JSON.stringify({
            type: "player_ready",
            payload: {
                gameId,
                readyPlayers: Array.from(game.readyPlayers),
            },
        }));
    }

    if (game.readyPlayers.size === 2)
        startGame(game);
}
