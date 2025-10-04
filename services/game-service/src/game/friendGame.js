import { createGameRoom, createInitialGameState, isPlaying } from "../helpers/helpers.js";
import { games, playersSockets } from "../utils/store.js";
import { startGameLoop } from "./gameLoop.js";

async function friendRoutes(fastify, options) {
    fastify.post("/invite", async (request, reply) => {
        const { from, to } = request.body;

        if (from === to)
            return reply.status(400).send({ error: "Cannot invite yourself" });
        console.log(`Friend invite from : ${from}, to ${to}`);

        const host_socket = playersSockets.get(from);
        const guest_socket = playersSockets.get(to);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest not online" });
        if (!host_socket)
            return reply.status(404).send({ error: "Host not online" });

        if (isPlaying(to))
            return reply.status(404).send({ error: "Player is already in a game." });

        const friendRoom = createGameRoom(from, null, host_socket, "friend");

        guest_socket.send(JSON.stringify({
            type: "friend_invite",
            from: from,
            roomId: friendRoom.roomId
        }));

        return reply.send({ message: "Invite sent successfully", roomId: friendRoom.roomId });
    });


    fastify.post("/invite/accept", async (request, reply) => {
        const { roomId, guest_id } = request.body;

        const guest_socket = playersSockets.get(guest_id);
        const friendRoom = games.get(roomId);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest socket not found" });

        if (!friendRoom)
            return reply.status(404).send({ error: "Room not found" });

        if (friendRoom.p2 != null)
            return reply.status(400).send({ error: "Room already full" });

        const host_socket = playersSockets.get(friendRoom.p1);

        if (!host_socket)
            return reply.status(404).send({ error: "Host socket not found" });

        if (guest_socket.readyState !== 1)
            return reply.status(400).send({ error: "Guest disconnected" });
        if (host_socket.readyState !== 1)
            return reply.status(400).send({ error: "Host disconnected" });

        if (isPlaying(friendRoom.p1)) {
            games.delete(roomId);
            return reply.status(404).send({ error: "Host is already in a game." });
        }
        friendRoom.p2 = guest_id;
        friendRoom.sockets.add(guest_socket);

        host_socket.send(
            JSON.stringify({
                type: "invite_accepted",
                roomId,
                opponent: guest_id
            })
        );

        setTimeout(() => {
            friendRoom.sockets.forEach(sock => sock.send(JSON.stringify(createInitialGameState(roomId))));
        }, 2000);
        setTimeout(() => {
            friendRoom.sockets.forEach(sock => {
                sock.send(JSON.stringify({ type: "game_start" }));
            });
            friendRoom.status = "ongoing";
            startGameLoop(friendRoom);
        }, 3000);

        return reply.send({ success: true, roomId });
    });


    fastify.post("/invite/decline", async (request, reply) => {
        const { roomId, guest_id } = request.body;

        const guest_socket = playersSockets.get(guest_id);
        const friendRoom = games.get(roomId);

        if (!guest_socket)
            return reply.status(404).send({ error: "Guest socket not found" });

        if (!friendRoom)
            return reply.status(404).send({ error: "Room not found" });

        const host_socket = playersSockets.get(friendRoom.p1);

        if (games.has(roomId))
            games.delete(roomId);

        if (!host_socket)
            return reply.status(404).send({ error: "Host socket not found" });
        host_socket.send(
            JSON.stringify({
                type: "invite_declined",
                roomId,
                opponent: guest_id
            })
        );

        return reply.send({ success: true });
    });
}

export default friendRoutes;