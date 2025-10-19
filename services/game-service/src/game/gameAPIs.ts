
import {FastifyInstance, FastifyRequest, FastifyReply} from "fastify";
import {games, playersSockets} from "../utils/store.js";
import {GameMode, GameRoom} from "../utils/types.js";
import {createGameRoom} from "../helpers/helpers.js";
import {GAME_ROOM_MODE, GAME_ROOM_STATUS, GameRoomMode} from "../helpers/consts.js";
import {gameUpdate, GameUpdatePayload} from "./gameLoop.js";

interface CreateGameBody {
    playerId: string;
    mode: GameRoomMode;
}

interface JoinGameBody {
    playerId: string;
}

export async function gameAPIs(fastify: FastifyInstance, options: any) {

    fastify.post("/api/game/create", (req: FastifyRequest<{ Body: CreateGameBody }>, reply: FastifyReply) => {
        const { playerId, mode } = req.body;

        if (!playerId || !mode) {
            return reply.code(400).send({
                message: "playerId and mode are required!"
            });
        }

        if (!Object.values(GAME_ROOM_MODE).includes(mode as GameRoomMode)) {
            return reply.code(400).send({
                message: "mode not available!"
            });
        }

        const player1_socket = playersSockets.get(playerId);
        if (!player1_socket) {
            return reply.code(404).send({
                message: "player not connected!"
            });
        }

        const gameRoom: GameRoom = createGameRoom(playerId, null, player1_socket, mode);
        games.set(gameRoom.gameId, gameRoom);

        return reply.code(201).send({
            message: "Game room created successfully",
            gameId: gameRoom.gameId
        });
    });

    fastify.post("/api/game/join/:id", (req: FastifyRequest<{ Body: JoinGameBody; Params: { id: string } }>, reply: FastifyReply) => {
        const { playerId } = req.body;
        const { id: gameId } = req.params;

        if (!playerId) {
            return reply.code(400).send({
                message: "playerId is required!"
            });
        }

        const gameRoom = games.get(gameId);
        if (!gameRoom) {
            return reply.code(404).send({
                message: "Game room not found!"
            });
        }

        if (gameRoom.p2) {
            return reply.code(400).send({
                message: "Game room is already full!"
            });
        }

        const player2_socket = playersSockets.get(playerId);
        if (!player2_socket) {
            return reply.code(404).send({
                message: "player not connected!"
            });
        }

        gameRoom.p2 = playerId;
        gameRoom.sockets.add(player2_socket);

        return reply.code(200).send({
            message: "Joined game successfully",
            gameId: gameRoom.gameId
        });
    });

    fastify.post("/api/game/input", (req: FastifyRequest<{ Body: GameUpdatePayload }>, reply: FastifyReply) => {
        const { gameId, playerId, input } = req.body;

        const gameRoom = games.get(gameId);
        if (!gameRoom) {
            return reply.code(404).send({ message: "Game not found!" });
        }

        if (gameRoom.p1 !== playerId && gameRoom.p2 !== playerId) {
            return reply.code(403).send({ message: "Player not in this game!" });
        }

        gameUpdate(req.body);

        return reply.code(200).send({ message: "Input received" });
    });

    fastify.get("/api/game/state/:id", (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id: gameId } = req.params;
        const gameRoom = games.get(gameId);

        if (!gameRoom) {
            return reply.code(404).send({ message: "Game not found!" });
        }

        return reply.code(200).send({
            gameRoom
        });
    });
}
