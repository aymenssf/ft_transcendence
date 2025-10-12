const WIN_SCORE = 5;
const PADDLE_SPEED = 15;
const BALL_SPEED = 10;

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const PADDLE_HEIGHT = CANVAS_HEIGHT / 4;
const PADDLE_WIDTH = 10;
const BALL_START = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
// Enums or literal types for stricter typing
export const TOURNAMENT_STATUS = {
    WAITING: "waiting",
    SEMI_FINAL: "semifinals",
    FINAL: "final",
    FINISHED: "finished",
} as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

export const GAME_ROOM_STATUS = {
    WAITING: "waiting",
    ONGOING: "ongoing",
    FINISHED: "finished",
} as const;

export type GameRoomStatus = (typeof GAME_ROOM_STATUS)[keyof typeof GAME_ROOM_STATUS];

export const GAME_ROOM_MODE = {
    LOCAL: "local",
    FRIEND: "friend",
    RANDOM: "random",
    AI_OPPONENT: "ai_opponent",
    TOURNAMENT: "tournament",
} as const;

export type GameRoomMode = (typeof GAME_ROOM_MODE)[keyof typeof GAME_ROOM_MODE];

export const AI_OPPONENT_DIFFICULTY = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
} as const;

export type AIOpponentDifficulty = (typeof AI_OPPONENT_DIFFICULTY)[keyof typeof AI_OPPONENT_DIFFICULTY];

export {
    WIN_SCORE, PADDLE_SPEED, BALL_SPEED,
    CANVAS_HEIGHT, CANVAS_WIDTH, PADDLE_HEIGHT,
    PADDLE_WIDTH, BALL_START,
}