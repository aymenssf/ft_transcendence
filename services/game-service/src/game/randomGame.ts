import { waitingQueue, playersSockets } from '../utils/store.js'
import { createGameRoom, createInitialGameState, isPlaying } from "../helpers/helpers.js"
import { startGameLoop } from "./gameLoop.js";
import { SocketStream } from "@fastify/websocket";
import { GAME_ROOM_MODE, GAME_ROOM_STATUS } from "../helpers/consts.js";

function randomGame(connection: SocketStream, playerId: string) {
    if (isPlaying(playerId)) {
        connection.socket.send(JSON.stringify({
            type: "join_error",
            payload: {
                playerId,
                message: 'Player is already in game'
            }
        }));
    }
    console.log(`${playerId} requested to join random`);
    if (!waitingQueue.has(playerId))
        waitingQueue.add(playerId);

    connection.socket.send(JSON.stringify({
        type: "join_random_ack",
        payload: { playerId }
    }));

    if (waitingQueue.size >= 2)
        startRandomGame();
}

function startRandomGame() {
    const iterator = waitingQueue.values();
    const player_1 = iterator.next().value;

    if (player_1) waitingQueue.delete(player_1);
    const player_2 = iterator.next().value;
    if (player_2) waitingQueue.delete(player_2);

    if (!player_1 || !player_2) {
        console.error("Both players must be defined");
        return;
    }

    console.log(`Player [${player_1} VS ${player_2}]`);

    const player_1_socket = playersSockets.get(player_1);
    const player_2_socket = playersSockets.get(player_2);

    const gameRoom = createGameRoom(player_1, player_2, player_1_socket, GAME_ROOM_MODE.RANDOM);

    gameRoom.sockets.add(player_2_socket);
    gameRoom.sockets.forEach(sock => {
        sock?.send(JSON.stringify({
            type: "random_opponent_found",
            payload: {
                player1: gameRoom.p1,
                player2: gameRoom.p2
            }
        }));
    })

    gameRoom.status = GAME_ROOM_STATUS.ONGOING;
    setTimeout(() => {
        gameRoom.sockets.forEach(sock => sock?.send(JSON.stringify(createInitialGameState(gameRoom.gameId, gameRoom.mode))));
    }, 2000);

    setTimeout(() => {
        gameRoom.sockets.forEach(sock => {
            sock?.send(JSON.stringify({
                type: "game_start"
            }));
        });
        startGameLoop(gameRoom);
    }, 3000);

}

export default randomGame;