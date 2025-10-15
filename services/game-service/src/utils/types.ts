export type GameMode = "local" | "friend" | "random" | "ai_opponent" | "tournament";
export type GameStatus = "waiting" | "ongoing" | "finished";
export type Difficulty = "easy" | "medium" | "hard";
export type TournamentStatus = "waiting" | "semifinals" | "final" | "finished";
import {WebSocket} from "ws";

export interface GameCanvas {
    width: number;
    height: number;
}
export interface GamePaddles {
    left: {
        x: number;
        y: number;
        up: boolean;
        down: boolean;
        score: number;
    };
    right: {
        x: number;
        y: number;
        up: boolean;
        down: boolean;
        score: number;
    };
    width: number;
    height: number;
}

export interface GameBall {
    radius: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
}

export interface GameState {
    canvas: GameCanvas;
    paddles: GamePaddles;
    ball: GameBall;
}

export interface GameRoom {
    gameId: string;
    p1: string | null;
    p2: string | null;
    status: GameStatus;
    mode: GameMode;
    difficulty?: Difficulty;
    sockets: Set<WebSocket | undefined>;
    loop: ReturnType<typeof setInterval> | null;
    state: GameState;
    readyPlayers: Set<String>;
    winner: string|null;
}

export interface Tournament {
    tournamentId: string;
    title: string;
    status: TournamentStatus;
    players: string[];
    rounds: GameRoom[]; // list of game rooms (semis + final)
    winner: string | null;
}

