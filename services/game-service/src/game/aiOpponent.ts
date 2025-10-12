import { createGameRoom, createInitialGameState } from "../helpers/helpers.js";
import { gameUpdate, startGameLoop } from "./gameLoop.js";
import WebSocket from "ws";
import {SocketStream} from "@fastify/websocket";

export function aiOpponentGame(connection:SocketStream, playerId: string, difficulty: string) {
    console.log(`Player ${playerId} requests AI opponent , difficulty: ${difficulty}`);

    const game_room = createGameRoom(playerId, "ai", connection.socket, "ai_opponent");

    const aiSocket = new WebSocket(process.env.AI_SERVICE_URL || "ws://ai-service:3013/");

    aiSocket.on("open", () => {
        console.log("Connected to AI service");

        game_room.sockets.add(aiSocket);

        connection.socket.send(JSON.stringify({
            type: "join_ai-opponent_ack",
            payload: { roomId: game_room.gameId }
        }));

        game_room.sockets.forEach(sock => {
            if (sock?.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify(createInitialGameState(game_room.gameId, game_room.mode, difficulty)));
            }
        });

        setTimeout(() => {
            game_room.sockets.forEach(sock => {
                sock?.send(JSON.stringify({
                    type: "game_start"
                }));
            });
            startGameLoop(game_room);
        }, 3000);

    });


    aiSocket.on("message", (msg) => {
        const { type, payload } = JSON.parse(msg.toString());

        if (type === "game_update")
            gameUpdate(payload);
    });

    aiSocket.on("error", (error) => {
        console.error("ai service connection error:", error);
        connection.socket.send(JSON.stringify({
            type: "error",
            payload: { message: "Failed to connect to AI service" }
        }));

        //end gmae
    });

    aiSocket.on("close", () => {
        console.log("AI service disconnected");
        game_room.sockets.delete(aiSocket);
        // end game
    });

}