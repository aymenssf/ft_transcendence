import { createGameRoom, createInitialGameState} from "../helpers/helpers.js";
import { gameUpdate, startGameLoop } from "./gameLoop.js";

export function aiOpponentGame(connection, playerId) {
    console.log(`Player ${playerId} requests AI opponent`);

    const game_room = createGameRoom(playerId, connection, "ai_opponent");
    game_room.p2 = "ai";

    const aiSocket = new WebSocket(process.env.AI_SERVICE_URL || "ws://ai-service:3013");

    aiSocket.on("open", () => {
        console.log("Connected to AI service");

        game_room.sockets.add(aiSocket);

        connection.socket.send(JSON.stringify({
            type: "join_ai-opponent_ack",
            payload: { roomId: game_room.id }
        }));

        game_room.sockets.forEach(sock => sock.send(JSON.stringify(createInitialGameState(game_room.gameId, game_room.mode))));

        // setTimeout(() => {
        //     game_room.sockets.forEach(sock => {
        //         sock.send(JSON.stringify({
        //             type: "game_start"
        //         }));
        //     });
        //     startGameLoop(game_room);
        // }, 3000);

    });


    aiSocket.on("message", (msg) => {
        const { type, payload } = JSON.parse(msg.toString());

        if (type === "ai_move")
            gameUpdate(payload);
    });

    aiSocket.on("close", () => {
        console.log("AI socket closed");
        //end game///
    });

    aiSocket.on("error", (err) => {
        console.error("AI socket error");
        //end gme
    });
}