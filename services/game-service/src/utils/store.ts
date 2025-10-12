// Collections for game logic
import {GameRoom, Tournament} from "./types.js";
import {WebSocket} from "ws";

export const waitingQueue = new Set<string>();;
export const games = new Map<string,GameRoom>();        // Map<string, GameRoom>
export const tournaments = new Map<string, Tournament>(); // Map<string, Tournament>


// for conected players
export const playersSockets = new Map<string, WebSocket>();