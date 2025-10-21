import { GAME_ROOM_MODE, GAME_ROOM_STATUS } from "../helpers/consts.js";
import { createGameRoom, createInitialGameState, isPlaying } from "../helpers/helpers.js";
import { verifyJWT } from "../middleware/verifyJWT.js";
import { games, playersSockets } from "../utils/store.js";
import { startGameLoop } from "./gameLoop.js";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface InviteBody {
    from?: string;
    to: string;
}
interface InviteAcceptBody {
    gameId: string;
    guestId?: string;
}

async function friendRoutes(fastify: FastifyInstance, options: any) {
    fastify.post<{ Body: InviteBody }>("/invite", { preHandler: [verifyJWT] }, async (request, reply) => {
        const user = (request as any).user;
        const from = user.userId;
        const { to } = request.body;

        if (from === to || !to)
            return reply.status(400).send({ error: "Cannot invite yourself or guest invalid" });
        console.log(`Friend invite from : ${from}, to ${to}`);

        const host_socket = playersSockets.get(from);
        const guest_socket = playersSockets.get(to);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest not online" });
        if (!host_socket)
            return reply.status(404).send({ error: "Host not online" });

        if (isPlaying(to))
            return reply.status(404).send({ error: "Player is already in a game." });

        const friendRoom = createGameRoom(from, null, host_socket, GAME_ROOM_MODE.FRIEND);

        guest_socket.send(JSON.stringify({
            type: "friend_invite",
            from: from,
            roomId: friendRoom.gameId
        }));

        return reply.send({ message: "Invite sent successfully", roomId: friendRoom.gameId });
    });

    fastify.post<{ Body: InviteAcceptBody }>("/invite/accept", { preHandler: [verifyJWT] }, async (request, reply) => {
        const user = (request as any).user;
        const guestId = user.userId;
        const { gameId } = request.body;

        if (!gameId)
            return reply.status(400).send({ error: "gameId invalid" });

        const guest_socket = playersSockets.get(guestId);
        const friendRoom = games.get(gameId);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest socket not found" });

        if (!friendRoom)
            return reply.status(404).send({ error: "Room not found" });

        if (friendRoom.p2 != null)
            return reply.status(400).send({ error: "Room already full" });
        let host_socket = null;
        if (friendRoom.p1 != null) {
            host_socket = playersSockets.get(friendRoom.p1);
        }

        if (!host_socket)
            return reply.status(404).send({ error: "Host socket not found" });

        if (guest_socket.readyState !== 1)
            return reply.status(400).send({ error: "Guest disconnected" });
        if (host_socket.readyState !== 1)
            return reply.status(400).send({ error: "Host disconnected" });

        if (friendRoom.p1 && isPlaying(friendRoom.p1)) {
            games.delete(gameId);
            return reply.status(404).send({ error: "Host is already in a game." });
        }
        friendRoom.p2 = guestId;
        friendRoom.sockets.add(guest_socket);

        host_socket.send(
            JSON.stringify({
                type: "invite_accepted",
                gameId,
                opponent: guestId
            })
        );

        setTimeout(() => {
            friendRoom.sockets.forEach(sock =>
                sock?.send(JSON.stringify(createInitialGameState(gameId, GAME_ROOM_MODE.FRIEND))));
        }, 2000);
        setTimeout(() => {
            friendRoom.sockets.forEach(sock => {
                sock?.send(JSON.stringify({ type: "game_start" }));
            });
            friendRoom.status = GAME_ROOM_STATUS.ONGOING;
            startGameLoop(friendRoom);
        }, 3000);

        return reply.send({ success: true, gameId });
    });


    fastify.post<{ Body: InviteAcceptBody }>("/invite/decline", { preHandler: [verifyJWT] }, async (request, reply) => {
        const user = (request as any).user;
        const guestId = user.userId;
        const { gameId } = request.body;

        if (!gameId)
            return reply.status(400).send({ error: "Cannot invite yourself" });

        const guest_socket = playersSockets.get(guestId);
        const friendRoom = games.get(gameId);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest socket not found" });

        if (!friendRoom)
            return reply.status(404).send({ error: "Room not found" });

        let host_socket = null;
        if (friendRoom.p1 != null)
            host_socket = playersSockets.get(friendRoom.p1);

        if (games.has(gameId))
            games.delete(gameId);

        if (!host_socket)
            return reply.status(404).send({ error: "Host socket not found" });
        host_socket.send(
            JSON.stringify({
                type: "invite_declined",
                gameId,
                opponent: guestId
            })
        );

        return reply.send({ success: true });
    });
}

export default friendRoutes;