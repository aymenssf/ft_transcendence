const WIN_SCORE = 5;
const PADDLE_SPEED = 15;
const BALL_SPEED = 10;

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const PADDLE_HEIGHT = CANVAS_HEIGHT / 4;
const PADDLE_WIDTH = 10;
const BALL_START = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

const TOURNAMENT_STATUS = {
    WAITING: "waiting",
    SEMI_FINAL: "semifinals",
    FINAL: "final",
    FINISHED: "finished"
}


const GAME_ROOM_STATUS = {
    WAITING: "waiting",
    ONGOING: "ongoing",
    FINISHED: "finished"
}

const GAME_ROOM_MODE = {
    LOCAL: "local",
    FRIEND: "friend",
    RANDOM: "random",
    AI_OPPONENT: "ai_opponent",
    TOURNAMENT: "tournament"
}

const AI_OPPONENT_DIFFICULTY = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard"
}

export {
    WIN_SCORE, PADDLE_SPEED, BALL_SPEED,
    CANVAS_HEIGHT, CANVAS_WIDTH, PADDLE_HEIGHT,
    PADDLE_WIDTH, BALL_START, GAME_ROOM_STATUS,
    GAME_ROOM_MODE, AI_OPPONENT_DIFFICULTY,
    TOURNAMENT_STATUS
}