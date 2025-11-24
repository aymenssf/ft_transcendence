import { randomUUID } from "crypto";
import { games, playersSockets, tournaments } from "../utils/store.js"
import { GAME_ROOM_MODE, GAME_ROOM_STATUS, TOURNAMENT_STATUS } from "../helpers/consts.js"
import { createGameRoom, findSocketForPlayer, getTournamentByRoomId } from "../helpers/helpers.js";
import { GameRoom, Tournament, TournamentStatus } from "../utils/types.js";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import WebSocket from "ws"
import { startGame } from "./gameLoop.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

function createTournament(playerId: string, title = "Classic Tournament"): Tournament {
    const tournamentId: string = randomUUID();

    return {
        tournamentId,
        title,
        status: TOURNAMENT_STATUS.WAITING,
        players: [playerId],
        rounds: [],
        winner: null
    };
}


export function handleTournamentRoundWinner(gameRoom: GameRoom) {
    const tournament = getTournamentByRoomId(gameRoom.gameId);
    if (!tournament) return;
    console.log(`Tournament Match Finished between ${gameRoom.p1} and ${gameRoom.p2} : Winner is ${gameRoom.winner}`);
    gameRoom.status = GAME_ROOM_STATUS.FINISHED;
    const roundIndex = tournament.rounds.findIndex(r => r.gameId === gameRoom.gameId);
    if (roundIndex !== -1) tournament.rounds[roundIndex] = gameRoom;

    if (tournament.status === TOURNAMENT_STATUS.FINAL) {
        tournament.winner = gameRoom.winner;
        tournament.status = TOURNAMENT_STATUS.FINISHED;

        notifyTournamentPlayers(tournament.tournamentId, TOURNAMENT_STATUS.FINISHED);
        return;
    }

    const [semi1, semi2] = tournament.rounds;
    if (!semi1 || !semi2) return;

    if (semi1.status === GAME_ROOM_STATUS.FINISHED && semi2.status === GAME_ROOM_STATUS.FINISHED) {
        const winner1 = semi1.winner;
        const winner2 = semi2.winner;
        if (!winner1 || !winner2) return;

        tournament.status = TOURNAMENT_STATUS.FINAL;

        const winner1_sock = findSocketForPlayer(semi1, winner1);
        const winner2_sock = findSocketForPlayer(semi2, winner2);

        const finalRoom = createGameRoom(winner1, winner2, winner1_sock, GAME_ROOM_MODE.TOURNAMENT);
        if (winner2_sock) finalRoom.sockets.add(winner2_sock);

        tournament.rounds.push(finalRoom);
        games.set(finalRoom.gameId, finalRoom);

        notifyTournamentPlayers(tournament.tournamentId, TOURNAMENT_STATUS.FINAL);
        startGame(finalRoom);
    }
}

function playerAlreadyInTournament(playerId: string) {
    for (const tournament of tournaments.values()) {
        if (tournament.status !== TOURNAMENT_STATUS.FINISHED && tournament.players.includes(playerId))
            return true;
    }
    return false;
}

function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


export function notifyTournamentPlayers(tournamentId: string, status: TournamentStatus) {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) return;

    let message;

    if (status === TOURNAMENT_STATUS.SEMI_FINAL) {
        message = {
            type: "tournament_semi-finals",
            payload: {
                tournamentId,
                semi1: {
                    players: [tournament.rounds[0].p1, tournament.rounds[0].p2],
                    gameId: tournament.rounds[0].gameId,
                },
                semi2: {
                    players: [tournament.rounds[1].p1, tournament.rounds[1].p2],
                    gameId: tournament.rounds[1].gameId,
                },
            },
        };
    } else if (status === TOURNAMENT_STATUS.FINAL) {
        const finalRound = tournament.rounds.at(-1);
        if (!finalRound) return;

        message = {
            type: "tournament_final",
            payload: {
                tournamentId,
                final: {
                    players: [finalRound.p1, finalRound.p2],
                    gameId: finalRound.gameId,
                },
            },
        };
    } else if (status === TOURNAMENT_STATUS.FINISHED) {
        message = {
            type: "tournament_finish",
            payload: {
                tournamentId,
                winner: tournament.winner,
            },
        };
    } else return;


    const data = JSON.stringify(message);

    const uniqueSockets = new Set<WebSocket>();

    for (const room of tournament.rounds) {
        for (const s of room.sockets) {
            if (s)
                uniqueSockets.add(s);
        }
    }

    for (const sock of uniqueSockets) {
        if (sock?.readyState === WebSocket.OPEN)
            sock.send(data);
    }
    console.log(`********** ${message.type}********* sent To : ${uniqueSockets.size}`);
}


function startTournament(tournamentId: string) {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) return;

    tournament.status = TOURNAMENT_STATUS.SEMI_FINAL;

    const shuffled = shuffle([...tournament.players]);

    const pairs = [
        [shuffled[0], shuffled[1]],
        [shuffled[2], shuffled[3]],
    ];

    tournament.rounds = [];

    for (const [p1, p2] of pairs) {
        const socket1 = playersSockets.get(p1);
        const socket2 = playersSockets.get(p2);

        if (!socket1 && !socket2) {
            const gameRoom = createGameRoom(p1, p2, undefined, GAME_ROOM_MODE.TOURNAMENT);
            gameRoom.status = GAME_ROOM_STATUS.FINISHED;
            tournament.rounds.push(gameRoom);
        } else if (!socket1) {
            const gameRoom = createGameRoom(p1, p2, undefined, GAME_ROOM_MODE.TOURNAMENT);
            gameRoom.sockets.add(socket2);
            gameRoom.winner = p2;
            gameRoom.state.paddles.right.score = 5;
            gameRoom.status = GAME_ROOM_STATUS.FINISHED;
            tournament.rounds.push(gameRoom);
        } else if (!socket2) {
            const gameRoom = createGameRoom(p1, p2, socket1, GAME_ROOM_MODE.TOURNAMENT);
            gameRoom.winner = p1;
            gameRoom.state.paddles.left.score = 5;
            gameRoom.status = GAME_ROOM_STATUS.FINISHED;
            tournament.rounds.push(gameRoom);
        } else {

            const gameRoom = createGameRoom(p1, p2, socket1, GAME_ROOM_MODE.TOURNAMENT);
            gameRoom.sockets.add(socket2);
            tournament.rounds.push(gameRoom);
            games.set(gameRoom.gameId, gameRoom);
            // TO BE COMPLETED LATERRRR>>>>>>>>>>>

        }

    }
    // if (tournament.rounds[0].status !== GAME_ROOM_STATUS.FINISHED && tournament.rounds[1].status !== GAME_ROOM_STATUS.FINISHED)
    notifyTournamentPlayers(tournamentId, TOURNAMENT_STATUS.SEMI_FINAL);
    setTimeout(() => {
        if (tournament.rounds[0].status !== GAME_ROOM_STATUS.FINISHED) startGame(tournament.rounds[0]);
        if (tournament.rounds[1].status !== GAME_ROOM_STATUS.FINISHED) startGame(tournament.rounds[1]);
    }, 10000);

}

interface TournamentCreateBody {
    playerId: string;
    title: string;
}
export async function tournamentRoute(fastify: FastifyInstance, options: any) {

    fastify.get("/tournaments", (req: FastifyRequest, reply: FastifyReply) => {
        const nonStartedTournaments = Array.from(tournaments.values()).filter(
            (tournament) => tournament.status === TOURNAMENT_STATUS.WAITING
        );

        return reply.send(nonStartedTournaments);
    });

    fastify.get('/tournaments/:tournamentID', (req: FastifyRequest, reply: FastifyReply) => {
        const { tournamentID } = req.params as { tournamentID: string };
        const tournament = tournaments.get(tournamentID);
        if (!tournament) {
            return reply.status(404).send({ error: 'Tournament not found' });
        }
        return reply.send(tournament);
    });


    fastify.post<{ Body: TournamentCreateBody }>("/tournaments/create", { preHandler: [verifyJWT] }, (req, reply) => {
        const user = (req as any).user;
        const playerId = user.userId;
        const { title } = req.body;

        if (!playerId)
            return reply.code(400).send({ error: "playerId is required" });

        // if (playerAlreadyInTournament(playerId))
        //     return reply.code(400).send({ error: "playerId already in another tournament" });

        const tournament = createTournament(playerId, title);
        tournaments.set(tournament.tournamentId, tournament);

        playersSockets.forEach(sock => {
            if (sock.readyState === 1) {
                try {
                    sock.send(JSON.stringify({
                        type: "tournament_created",
                        payload: {
                            tournamentId: tournament.tournamentId,
                            title: tournament.title,
                            numPlayers: tournament.players.length
                        }
                    }));
                } catch (err) {
                    console.error("Failed to send WS message:", err);
                }
            }
        });
        console.log("new Tournament has been created");
        return reply.code(201).send({
            message: "Created successfully",
            tournamentId: tournament.tournamentId
        });
    });

    interface TournamentJoinBody {
        tournamentId: string;
        playerId: string;
    }
    fastify.post<{ Body: TournamentJoinBody }>("/tournaments/join", { preHandler: [verifyJWT] }, (req, reply) => {
        const user = (req as any).user;
        const playerId = user.userId;
        const { tournamentId } = req.body;

        if (!tournamentId || !tournaments.has(tournamentId))
            return reply.code(404).send({ message: "Tournament not found" });

        if (!playerId)
            return reply.code(400).send({ message: "playerId is required" });

        // if (playerAlreadyInTournament(playerId))
        //     return reply.code(400).send({ error: "playerId already in another tournament" });

        const tournament = tournaments.get(tournamentId);

        if (tournament?.players.includes(playerId))
            return reply.code(400).send({ message: "Player already in tournament" });

        if (tournament?.players.length && tournament.players.length >= 4)
            return reply.code(400).send({ message: "Tournament is full" });


        tournament?.players.push(playerId);

        playersSockets.forEach(sock => {
            if (sock.readyState === 1) {
                try {
                    sock.send(JSON.stringify({
                        type: "tournament_player-joined",
                        payload: {
                            tournamentId,
                            numPlayers: tournament?.players.length
                        }
                    }));
                } catch (err) {
                    console.error("WS send error:", err);
                }
            }
        });

        if (tournament?.players.length === 4) {
            console.log(`Tournament ${tournament.tournamentId} has 4 players!`);
            setTimeout(() => {
                startTournament(tournamentId);
            }, 2000);
        }


        return reply.code(200).send({
            message: "Player joined tournament successfully",
            tournamentId,
            numPlayers: tournament?.players.length
        });
    });

    interface TournamentLeaveBody {
        tournamentId: string;
        playerId: string;
    }
    fastify.post<{ Body: TournamentLeaveBody }>("/tournaments/leave", { preHandler: [verifyJWT] }, (req, reply) => {
        const user = (req as any).user;
        const playerId = user.userId;
        const { tournamentId } = req.body;

        if (!tournaments.has(tournamentId))
            return reply.code(404).send({ message: "Tournament not found" });

        const tournament = tournaments.get(tournamentId);

        if (!tournament?.players.includes(playerId))
            return reply.code(404).send({ message: "Player not in tournament" });

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

            return reply.code(200).send({ message: "Tournament deleted because it was empty" });
        }

        playersSockets.forEach(sock => {
            if (sock.readyState === 1) {
                try {
                    sock.send(JSON.stringify({
                        type: "tournament_player-left",
                        payload: {
                            tournamentId,
                            numPlayers: tournament.players.length
                        }
                    }));
                } catch (err) {
                    console.error("WS send error:", err);
                }
            }
        });

        return reply.code(200).send({ message: "Player left tournament successfully" });
    });

}
