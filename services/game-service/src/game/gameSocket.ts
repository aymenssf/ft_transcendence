import { waitingQueue, games, playersSockets } from '../utils/store.js'
import { gameUpdate } from "./gameLoop.js";
import randomGame from "./randomGame.js"
import { findGameRoomByPlayer, handlePlayerDisconnect, handlePlayerReady, leaveTournament } from "../helpers/helpers.js"
import { localGame } from "./localGame.js";
import { aiOpponentGame } from './aiOpponent.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { GameRoom } from "../utils/types.js";
import { GAME_ROOM_STATUS } from "../helpers/consts.js";
import "@fastify/websocket";
import jwt from "@fastify/jwt"

interface SocketQuery {
    token: string;
}

async function gameSocket(fastify: FastifyInstance, options: any) {
    // @ts-ignore
    fastify.get('/ws', { websocket: true }, (connection: SocketStream, req: FastifyRequest<{ Querystring: SocketQuery }>) => {
        const token: string = req.query.token;
        if (!token) {
            connection.socket.close(1008, 'Missing token');
            return;
        }

        try {
            const payload = fastify.jwt.verify(token) as { userId: string };
            const playerId = (payload as any).userId;
            console.log(`New Socket Connection from ${playerId}`);

            console.log(`New socket connection from ${playerId}`);

            playersSockets.set(playerId, connection.socket);

            if (playerId)
                playersSockets.set(playerId, connection.socket);

            connection.socket.on("message", (data: any) => {
                try {
                    const { type, payload } = JSON.parse(data.toString());

                    if (type === "game_update")
                        gameUpdate(playerId, payload);
                    if (type === "join_random")
                        randomGame(connection, playerId);
                    if (type === "leave_random")
                        waitingQueue.delete(playerId);
                    if (type === "join_local")
                        localGame(connection, playerId);
                    if (type === "join_ai-opponent")
                        aiOpponentGame(connection, playerId, payload.difficulty);
                    if (type === "leave_game") {
                        // TO ADD LATER : end gameRoom...
                    }
                    if (type === "player_ready")
                        handlePlayerReady(connection, playerId, payload.gameId);

                } catch (err) {
                    console.error("Invalid message:", data.toString(), err);
                }
            });

            connection.socket.on('close', () => {
                handleSocketClose(playerId);
                leaveTournament(playerId);
                handlePlayerDisconnect(playerId);
                playersSockets.delete(playerId);
            });

            connection.socket.on('error', (error: any) => {
                console.error(`Error for ${playerId}:`, error);
            });

        } catch (err) {
            console.error('JWT verification failed:', err);
            connection.socket.close(1008, 'Invalid or expired token');
            return;
        }

    });
}

function cleanupRoom(roomId: string) {
    const room = games.get(roomId);
    if (!room) return;

    if (room.loop) {
        clearInterval(room.loop);
        room.loop = null;
    }

    games.delete(roomId);
}

function handleSocketClose(playerId: string) {
    console.log(`WS connection closed for ${playerId}`);
    playersSockets.delete(playerId);
    waitingQueue.delete(playerId);

    const gameRoom = findGameRoomByPlayer(playerId);
    if (!gameRoom || gameRoom.status === GAME_ROOM_STATUS.FINISHED) return;



    const opponentId = gameRoom.p1 === playerId ? gameRoom.p2 : gameRoom.p1;

    if (opponentId && opponentId !== "local") {
        const opponentSocket = playersSockets.get(opponentId);
        if (opponentSocket && opponentSocket.readyState === 1) {
            opponentSocket.send(JSON.stringify({
                type: "game_finish",
                payload: { winner: opponentId, reason: "disconnect" }
            }));
        }
    }

    if (gameRoom.loop) clearInterval(gameRoom.loop);
    gameRoom.status = GAME_ROOM_STATUS.FINISHED;

    cleanupRoom(gameRoom.gameId);
}



export default gameSocket;