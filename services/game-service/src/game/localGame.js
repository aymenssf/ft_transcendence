import { createInitialGameState, createGameRoom } from "../helpers/helpers.js"
import { startGameLoop } from "./gameLoop.js";
import { isPlaying } from '../helpers/helpers.js';

function localGame(connection, playerId) {
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

    const gameRoom = createGameRoom(playerId, "local", connection.socket, "local");

    gameRoom.status = "ongoing";

    connection.socket.send(JSON.stringify(createInitialGameState(gameRoom.gameId, gameRoom.mode)));

    setTimeout(() => {
        connection.socket.send(JSON.stringify({
            type: "game_start"
        }));
        startGameLoop(gameRoom);
    }, 3000);

}

export { localGame }