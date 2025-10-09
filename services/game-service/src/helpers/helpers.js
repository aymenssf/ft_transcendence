import { games } from "../utils/store.js";
import { randomUUID } from 'crypto';
import { BALL_START, CANVAS_HEIGHT, CANVAS_WIDTH, BALL_SPEED, PADDLE_HEIGHT, PADDLE_WIDTH, GAME_ROOM_STATUS, GAME_ROOM_MODE } from "./consts.js";

export function findGameRoomByPlayer(playerId) {
    for (const room of games.values()) {
        if (room.p1 === playerId || room.p2 === playerId)
            return room;
    }
    return null;
}

export function isPlaying(playerId) {
    for (const room of games.values()) {
        if ((room.p1 === playerId || room.p2 === playerId) && room.status === "ongoing")
            return true;
    }
    return false;
}


export function playerInOtherRoom(playerId, roomId) {
    if (findGameRoomByPlayer(playerId) == null)
        return false;

    for (const room of games.values()) {
        if (room.gameId !== roomId && (room.p1 === playerId || room.p2 === playerId))
            return true;
    }

    return false;
}

// export function assertRoomConsistency(room) {
//     if (!room.gameId) throw new Error("missing gameId");
//     if (room.status === "ongoing" && room.loop == null) throw new Error("ongoing but no loop");
//     if (room.status !== "ongoing" && room.loop != null) throw new Error("loop running when not ongoing");
//     if (room.p2 === null && room.mode !== "local" && room.status === "ongoing")
//         throw new Error("ongoing without p2");
// }

export function createInitialGameState(gameId, mode, difficulty = "easy") {
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

export function createGameRoom(player1, player2, player1_socket, mode = GAME_ROOM_MODE.RANDOM) {

    const gameId = randomUUID();
    const gameRoom = {
        gameId,
        p1: player1,
        p2: player2,
        status: GAME_ROOM_STATUS.WAITING,
        mode: mode,
        sockets: new Set([player1_socket]),
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
        winner : null

    };
    games.set(gameId, gameRoom);

    return gameRoom;

}