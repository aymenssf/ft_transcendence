import {randomUUID} from "crypto";
import {playersSockets, tournaments} from "../utils/store.js"
import {GAME_ROOM_MODE, GAME_ROOM_STATUS, TOURNAMENT_STATUS} from "../helpers/consts.js"
import {createGameRoom} from "../helpers/helpers.js";
import {Tournament} from "../utils/types.js";
import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";

function createTournament(playerId: string, title = "Classic Tournament"):Tournament {
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

function playerAlreadyInTournament(playerId: string) {
    for (const tournament of tournaments.values()) {
        if (tournament.status !== TOURNAMENT_STATUS.FINISHED && tournament.players.includes(playerId))
            return true;
    }
    return false;
}

function shuffle(array:any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startTournament(tournamentId:string) {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) return;

    tournament.status = TOURNAMENT_STATUS.SEMI_FINAL;

    const shuffled = shuffle([...tournament.players]);

    const pairs = [
        [shuffled[0], shuffled[1]],
        [shuffled[2], shuffled[3]],
    ];

    // broadcastTournametMatchs(pairs.)

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
        // TO BE COMPLETED LATERRRR>>>>>>>>>>>
        
        }

    }

}

interface TournamentCreateBody {
    playerId: string;
    title: string;
}
async function tournamentRoute(fastify:FastifyInstance, options: any) {
    fastify.post("/tournament/create", (req: FastifyRequest<{Body:TournamentCreateBody}>, reply: FastifyReply) => {
        const { playerId, title } = req.body;

        if (!playerId)
            return reply.code(400).send({ error: "playerId is required" });

        if (playerAlreadyInTournament(playerId))
            return reply.code(400).send({ error: "playerId already in another tournament" });

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

        return reply.code(201).send({
            message: "Created successfully",
            tournamentId: tournament.tournamentId
        });
    });

    interface TournamentJoinBody {
        tournamentId: string;
        playerId: string;
    }
    fastify.post("/tournament/join", (req: FastifyRequest<{Body:TournamentJoinBody}>, reply:FastifyReply) => {
        const { tournamentId, playerId } = req.body;

        if (!tournamentId || !tournaments.has(tournamentId))
            return reply.code(404).send({ message: "Tournament not found" });

        if (!playerId)
            return reply.code(400).send({ message: "playerId is required" });

        if (playerAlreadyInTournament(playerId))
            return reply.code(400).send({ error: "playerId already in another tournament" });

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
            // start the tournament...
            startTournament(tournamentId);
        }

        return reply.code(200).send({
            message: "Player joined tournament successfully",
            tournamentId,
            numPlayers: tournament?.players.length
        });
    });

    interface TournamentLeaveBody{
        tournamentId: string;
        playerId: string;
    }
    fastify.post("/tournament/leave", (req: FastifyRequest<{Body:TournamentLeaveBody}>, reply:FastifyReply) => {
        const { tournamentId, playerId } = req.body;

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