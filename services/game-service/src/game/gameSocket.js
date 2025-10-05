import { waitingQueue, games, playersSockets } from '../utils/store.js'
import { gameUpdate } from "./gameLoop.js";
import randomGame from "./randomGame.js"
import { findGameRoomByPlayer } from "../helpers/helpers.js"
import { localGame } from "./localGame.js";
import WebSocket from 'ws';

async function gameSocket(fastify, options) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        const playerId = req.query.player_id;
        console.log(`New Socket Connection from ${playerId}`);

        if (playerId)
            playersSockets.set(playerId, connection.socket);

        connection.socket.on("message", (data) => {
            try {
                const { type, payload } = JSON.parse(data.toString());

                if (type === "game_update")
                    gameUpdate(payload);
                if (type === "join_random")
                    randomGame(connection, playerId);
                if (type === "leave_random")
                    waitingQueue.delete(playerId);
                if (type === "join_local")
                    localGame(connection, playerId);
                if (type === "leave_game") {
                    // TO ADD LATER : end gameRoom...
                }
                if (type === "join_ai-opponent") {
                    // AI OPPONENT WILL BE HANDLED HERE
                    // {type: "new_instance", playerId}
                    //
                    // aiOpponent();{p1: x,y, ball:x,y. p2}
                    console.log('Request to play against AI');

                    const aiSocket = new WebSocket("ws://ai-service:3013");
                    
                    connection.socket.send(JSON.stringify({ type: "join_ai-opponent_ack", payload: {} }));
                }
                if (type === "invite_friend") {
                    // friend invitation .....
                    console.log('Friend invitation');
                }

            } catch (err) {
                console.error("Invalid message:", data.toString(), err);
            }
        });

        connection.socket.on('close', () => {
            handleSocketClose(playerId);
        });

        connection.socket.on('error', (error) => {
            console.error(`Error for ${playerId}:`, error);
            playersSockets.delete(playerId);
        });
    });
}

function cleanupRoom(roomId) {
    const room = games.get(roomId);
    if (!room) return;

    if (room.loop)
        clearInterval(room.loop);

    games.delete(roomId);
}

function handleSocketClose(playerId) {
    console.log(`WS connection closed for ${playerId}`);
    playersSockets.delete(playerId);

    const gameRoom = findGameRoomByPlayer(playerId);
    if (!gameRoom || gameRoom.status === "finished") return;

    const opponentId = gameRoom.p1 === playerId ? gameRoom.p2 : gameRoom.p1;

    if (opponentId !== "local") {
        const opponentSocket = playersSockets.get(opponentId);
        if (opponentSocket && opponentSocket.readyState === 1) {
            opponentSocket.send(JSON.stringify({
                type: "game_finish",
                payload: { winner: opponentId, reason: "disconnect" }
            }));
        }
    }

    if (gameRoom.loop) clearInterval(gameRoom.loop);
    gameRoom.status = "finished";

    cleanupRoom(gameRoom.gameId);
}



export default gameSocket;