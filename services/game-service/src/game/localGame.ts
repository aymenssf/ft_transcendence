import { createInitialGameState, createGameRoom } from "../helpers/helpers.js"
import { startGameLoop } from "./gameLoop.js";
import { isPlaying } from '../helpers/helpers.js';
import {SocketStream} from "@fastify/websocket";
import {GAME_ROOM_MODE, GAME_ROOM_STATUS} from "../helpers/consts.js";
import {GameRoom} from "../utils/types.js";

function localGame(connection: SocketStream, playerId: string) {
    if (isPlaying(playerId)) {
        connection.socket.send(JSON.stringify({
            type: "join_error",
            payload: {
                playerId,
                message: 'Player is already in game'
            }
        }));
        return;
    }
    connection.socket.send(JSON.stringify({
        type: "join_local_ack",
        payload: { playerId }
    }));

    const gameRoom: GameRoom = createGameRoom(playerId, "local", connection.socket, GAME_ROOM_MODE.LOCAL);

    gameRoom.status = GAME_ROOM_STATUS.ONGOING;

    connection.socket.send(JSON.stringify(createInitialGameState(gameRoom.gameId, gameRoom.mode)));

    setTimeout(() => {
        connection.socket.send(JSON.stringify({
            type: "game_start"
        }));
        startGameLoop(gameRoom);
    }, 500);

}

export { localGame }