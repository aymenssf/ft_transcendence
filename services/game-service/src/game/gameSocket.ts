import { waitingQueue, games, playersSockets, tournaments } from '../utils/store.js'
import { gameUpdate } from "./gameLoop.js";
import randomGame from "./randomGame.js"
import { findGameRoomByPlayer, getTournamentByRoomId, handlePlayerDisconnect, handlePlayerReady, leaveTournament } from "../helpers/helpers.js"
import { localGame } from "./localGame.js";
import { aiOpponentGame } from './aiOpponent.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { GameRoom } from "../utils/types.js";
import { GAME_ROOM_MODE, GAME_ROOM_STATUS, TOURNAMENT_STATUS } from "../helpers/consts.js";
import "@fastify/websocket";
import jwt from "@fastify/jwt"
import { handleTournamentRoundWinner, notifyTournamentPlayers } from './tournament.js';
import { saveGameRoom } from '../model/gameModels.js';
import WebSocket from "ws"
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
                    if (type === "player_leave") {
                        // TO ADD LATER : end gameRoom...
                        handlePlayerLeave(playerId);
                    }
                    if (type === "player_leave_match") {
                        handlePlayerLeaveMatch(playerId, payload);
                    }
                    if (type === "player_ready")
                        handlePlayerReady(connection, playerId, payload.gameId);

                } catch (err) {
                    console.error("Invalid message:", data.toString(), err);
                }
            });

            connection.socket.on('close', () => {
                    leaveTournament(playerId);
                cancelTournamentIfPlayerDisconnected(playerId);
                handlePlayerDisconnect(playerId, "disconnect");
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


export function cancelTournamentIfPlayerDisconnected(playerId: string) {
    for (const tournament of tournaments.values()) {
        if (tournament.status === TOURNAMENT_STATUS.WAITING || tournament.status === TOURNAMENT_STATUS.FINISHED)
            continue;

        let playerFound = false;

        if (tournament.status === TOURNAMENT_STATUS.FINAL) {
            const finalRoom = tournament.rounds.at(-1);
            if (!finalRoom) continue;

            if (finalRoom.p1 === playerId || finalRoom.p2 === playerId) {
                playerFound = true;
            }
        }
        else {
            const semi1 = tournament.rounds[0];
            const semi2 = tournament.rounds[1];

            if (!semi1 || !semi2) continue;

            if (
                playerId === semi1.p1 ||
                playerId === semi1.p2 ||
                playerId === semi2.p1 ||
                playerId === semi2.p2
            )
                playerFound = true;
        }

        if (playerFound) {
            tournament.status = TOURNAMENT_STATUS.CANCELED;
            tournaments.delete(tournament.tournamentId);

            for (const room of tournament.rounds) {
                if (!room) continue;

                if (room.loop) {
                    clearInterval(room.loop);
                    room.loop = null;
                }

                room.status = GAME_ROOM_STATUS.FINISHED;
                games.delete(room.gameId);
            }

            const uniqueSockets = new Set<WebSocket>();

            for (const room of tournament.rounds) {
                for (const s of room.sockets) {
                    if (s) uniqueSockets.add(s);
                }
            }

            const data = JSON.stringify({
                type: "tournament_canceled",
                payload: {
                    tournamentId: tournament.tournamentId,
                    reason: "player_disconnect : " + playerId,
                },
            });

            for (const sock of uniqueSockets) {
                if (sock.readyState === WebSocket.OPEN) {
                    sock.send(data);
                }
            }


            return;
        }
    }
}


function handlePlayerLeaveMatch(playerId: string, payload: any) {
    const gameRoom = games.get(payload.gameId);

    if (!gameRoom) return;
    if (gameRoom.status === GAME_ROOM_STATUS.FINISHED) 
    {
        return;
    }
    if (gameRoom.p1 !== playerId && gameRoom.p2 !== playerId) return;

    const opponentId = gameRoom.p1 === playerId ? gameRoom.p2 : gameRoom.p1;
    gameRoom.winner = opponentId;
    if (gameRoom.status === GAME_ROOM_STATUS.ONGOING) {

        gameRoom.status = GAME_ROOM_STATUS.FINISHED;

        const endGameMsg = JSON.stringify({
            type: "game_finish",
            payload: { winner: opponentId }
        });

        gameRoom.sockets.forEach(sock => sock?.send(endGameMsg));
    }
    if (gameRoom.mode === GAME_ROOM_MODE.AI_OPPONENT) {
        Array.from(gameRoom.sockets)[1]?.close();
    }
    if (gameRoom.loop) clearInterval(gameRoom.loop);
    saveGameRoom(gameRoom);
    games.delete(payload.gameId);

}


function handlePlayerLeave(playerId: string) {
    // Remove player from waiting queue
    waitingQueue.delete(playerId);
    leavePlayerFromWaitingTournaments(playerId);

    // Iterate over all game rooms
    for (const [roomId, room] of games.entries()) {
        const isPlayer1 = room.p1 === playerId;
        const isPlayer2 = room.p2 === playerId;
        if (!isPlayer1 && !isPlayer2) continue;

        const opponentId = isPlayer1 ? room.p2 : room.p1;
        // @ts-ignore
        const opponentSocket = playersSockets.get(opponentId);


        room.winner = opponentId;
        room.state.paddles.left.score = (room.p1 === opponentId) ? 5 : 0;
        room.state.paddles.right.score = (room.p2 === opponentId) ? 5 : 0;

        // Handle different room types
        switch (room.mode) {
            // Local or AI games
            case GAME_ROOM_MODE.LOCAL:
            case GAME_ROOM_MODE.AI_OPPONENT:
                if (room.status !== GAME_ROOM_STATUS.FINISHED) {
                    room.status = GAME_ROOM_STATUS.FINISHED;
                    room.winner = isPlayer1 ? room.p2 : room.p1;

                    room.status = GAME_ROOM_STATUS.FINISHED;

                    const endGameMsg = JSON.stringify({
                        type: "game_finish",
                        payload: { winner: room.winner }
                    });

                    room.sockets.forEach(sock => sock?.send(endGameMsg));
                    if (room.mode === GAME_ROOM_MODE.AI_OPPONENT)
                        Array.from(room.sockets)[1]?.close();
                    games.delete(roomId);
                }
                break;

            // Random game
            case GAME_ROOM_MODE.RANDOM:
                if (room.status === GAME_ROOM_STATUS.ONGOING) {

                    room.status = GAME_ROOM_STATUS.FINISHED;

                    const endGameMsg = JSON.stringify({
                        type: "game_finish",
                        payload: { winner: room.winner }
                    });

                    room.sockets.forEach(sock => sock?.send(endGameMsg));
                }
                games.delete(roomId);
                break;

            // Tournament game
            case GAME_ROOM_MODE.TOURNAMENT:
                if (room.status === GAME_ROOM_STATUS.ONGOING) {

                    room.status = GAME_ROOM_STATUS.FINISHED;

                    const endGameMsg = JSON.stringify({
                        type: "game_finish",
                        payload: { winner: room.winner }
                    });

                    room.sockets.forEach(sock => sock?.send(endGameMsg));

                    handleTournamentRoundWinner(room);
                }
                games.delete(roomId);
                break;

            case GAME_ROOM_MODE.FRIEND:
                if (room.status === GAME_ROOM_STATUS.WAITING) {

                    room.status = GAME_ROOM_STATUS.FINISHED;
                    games.delete(roomId);
                } else if (room.status === GAME_ROOM_STATUS.ONGOING) {

                    room.status = GAME_ROOM_STATUS.FINISHED;


                    const endGameMsg = JSON.stringify({
                        type: "game_finish",
                        payload: { winner: room.winner }
                    });

                    room.sockets.forEach(sock => sock?.send(endGameMsg));
                    games.delete(roomId);
                }
                break;

            default:
                console.warn(`[WARN] Unknown game type for room ${roomId}`);
        }

        games.delete(roomId);

        break;
    }
}


function leavePlayerFromWaitingTournaments(playerId: string) {
    for (const [tournamentId, tournament] of tournaments.entries()) {
        if (tournament.status === TOURNAMENT_STATUS.WAITING) {
            if (tournament.players.includes(playerId)) {
                tournament.players = tournament.players.filter(p => p !== playerId);

                if (tournament.players.length === 0) {
                    tournaments.delete(tournamentId);

                    playersSockets.forEach(sock => {
                        if (sock.readyState === 1) {
                            try {
                                sock.send(JSON.stringify({
                                    type: "tournament_deleted",
                                    payload: {
                                        tournamentId
                                    }
                                }));
                            } catch (err) {
                                console.error("WS send error:", err);
                            }
                        }
                    });
                }
            }

        }
    }
}

export function cleanupRoom(roomId: string) {
    const room = games.get(roomId);
    if (!room) return;

    if (room.loop) {
        clearInterval(room.loop);
        room.loop = null;
    }

    games.delete(roomId);
}

function handleSocketClose(playerId: string) {
    playersSockets.delete(playerId);
    waitingQueue.delete(playerId);

    const gameRoom = findGameRoomByPlayer(playerId);
    if (!gameRoom || gameRoom.status === GAME_ROOM_STATUS.FINISHED) return;



    const opponentId = gameRoom.p1 === playerId ? gameRoom.p2 : gameRoom.p1;

    if (opponentId && opponentId !== "local") {
        const opponentSocket = playersSockets.get(opponentId);
        if (opponentSocket?.readyState === 1) {
            opponentSocket?.send(JSON.stringify({
                type: "game_finish",
                payload: { winner: opponentId, reason: "disconnect" }
            }));
        }
        if (gameRoom.mode === GAME_ROOM_MODE.AI_OPPONENT)
            Array.from(gameRoom.sockets)[1]?.close();
    }

    if (gameRoom.loop) clearInterval(gameRoom.loop);
    gameRoom.status = GAME_ROOM_STATUS.FINISHED;
    saveGameRoom(gameRoom);
    cleanupRoom(gameRoom.gameId);
}



export default gameSocket;