import { BALL_SPEED, WIN_SCORE, PADDLE_SPEED, GAME_ROOM_STATUS, GAME_ROOM_MODE } from '../helpers/consts.js'
import { games } from "../utils/store.js";
import { GameBall, GameCanvas, GamePaddles, GameRoom } from "../utils/types.js";
import { WebSocket } from "ws";
import { createInitialGameState } from '../helpers/helpers.js';
import { handleTournamentRoundWinner } from './tournament.js';

function resetBall(gameRoom: GameRoom) {
    const { ball, canvas } = gameRoom.state;

    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = (Math.random() > 0.5 ? -BALL_SPEED : BALL_SPEED);
    ball.dy = (Math.random() > 0.5 ? -BALL_SPEED : BALL_SPEED);
}

function resetPaddles(gameRoom: GameRoom) {
    gameRoom.state.paddles.left.x = 15;
    gameRoom.state.paddles.left.y = gameRoom.state.canvas.height / 2 - 75;

    gameRoom.state.paddles.right.x = gameRoom.state.canvas.width - 25;
    gameRoom.state.paddles.right.y = gameRoom.state.canvas.height / 2 - 75;
}

function checkGameEnd(gameRoom: GameRoom, sockets: Set<WebSocket | undefined>) {
    const { left, right } = gameRoom.state.paddles;

    let winner = null;

    if (left.score >= WIN_SCORE)
        winner = gameRoom.p1;
    else if (right.score >= WIN_SCORE)
        winner = gameRoom.p2;

    if (winner) {
        gameRoom.winner = winner;
        gameRoom.status = GAME_ROOM_STATUS.FINISHED;
        const endGameMsg = JSON.stringify({
            type: "game_finish",
            payload: { winner }
        });

        sockets.forEach(sock => sock?.send(endGameMsg));
        if (gameRoom.mode === GAME_ROOM_MODE.AI_OPPONENT)
            Array.from(sockets)[1]?.close();

        if (gameRoom.mode === GAME_ROOM_MODE.TOURNAMENT)
            handleTournamentRoundWinner(gameRoom);
        return { finished: true, winner };
    }

    return { finished: false, winner: null };
}

function movePaddles(paddles: GamePaddles, canvas: GameCanvas) {
    if (paddles.left.up) paddles.left.y -= PADDLE_SPEED;
    if (paddles.left.down) paddles.left.y += PADDLE_SPEED;

    if (paddles.right.up) paddles.right.y -= PADDLE_SPEED;
    if (paddles.right.down) paddles.right.y += PADDLE_SPEED;

    paddles.left.y = Math.max(0, Math.min(canvas.height - paddles.height, paddles.left.y));
    paddles.right.y = Math.max(0, Math.min(canvas.height - paddles.height, paddles.right.y));
}

function moveBall(ball: GameBall, canvas: GameCanvas) {
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
        if (ball.y - ball.radius <= 0)
            ball.y = ball.radius;
        else
            ball.y = canvas.height - ball.radius;
        ball.dy = -ball.dy;
    }

}

function checkBallCollision(ball: GameBall, paddles: GamePaddles) {

    if (!paddles || !paddles.height || !paddles.width) return;

    const maxAngle = Math.PI / 4;
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) || 1;

    if (
        ball.x - ball.radius <= paddles.left.x + paddles.width &&
        ball.y + ball.radius >= paddles.left.y &&
        ball.y - ball.radius <= paddles.left.y + paddles.height
    ) {
        const paddleCenter = paddles.left.y + paddles.height / 2;
        let relativeY = (ball.y - paddleCenter) / (paddles.height / 2);
        relativeY = Math.max(-1, Math.min(1, relativeY));

        const bounceAngle = relativeY * maxAngle;
        ball.dx = Math.abs(speed * Math.cos(bounceAngle));
        ball.dy = speed * Math.sin(bounceAngle);

        ball.x = paddles.left.x + paddles.width + ball.radius;
    }


    if (
        ball.x + ball.radius >= paddles.right.x &&
        ball.y + ball.radius >= paddles.right.y &&
        ball.y - ball.radius <= paddles.right.y + paddles.height
    ) {
        const paddleCenter = paddles.right.y + paddles.height / 2;
        let relativeY = (ball.y - paddleCenter) / (paddles.height / 2);
        relativeY = Math.max(-1, Math.min(1, relativeY));

        const bounceAngle = relativeY * maxAngle;
        ball.dx = -Math.abs(speed * Math.cos(bounceAngle));
        ball.dy = speed * Math.sin(bounceAngle);

        ball.x = paddles.right.x - ball.radius;
    }
}

export function startGame(room: GameRoom) {

    room.sockets.forEach(sock => {
        sock?.send(JSON.stringify(createInitialGameState(room.gameId, room.mode)));
    });

    setTimeout(() => {
        room.sockets.forEach(sock => {
            sock?.send(JSON.stringify({
                type: "game_start"
            }));
        });
        startGameLoop(room);
    }, 3000);
}

export function startGameLoop(gameRoom: GameRoom, FPS = 60) {
    gameRoom.status = GAME_ROOM_STATUS.ONGOING;
    gameRoom.loop = setInterval(() => {
        const { state, sockets } = gameRoom;
        const { ball, paddles, canvas } = state;
        if (gameRoom.paused) return;
        movePaddles(paddles, canvas);
        moveBall(ball, canvas);
        checkBallCollision(ball, paddles);


        if (ball.x + ball.radius <= 0) {
            paddles.right.score++;
            resetBall(gameRoom);
            resetPaddles(gameRoom);
        }
        if (ball.x - ball.radius >= canvas.width) {
            paddles.left.score++;
            resetBall(gameRoom);
            resetPaddles(gameRoom);
        }

        const { finished, winner } = checkGameEnd(gameRoom, sockets);
        if (finished) {
            console.log(`Game over! Winner is: ${winner}`);
            if (gameRoom.loop) {
                clearInterval(gameRoom.loop);
                gameRoom.loop = null;
            }
        }
        const updateMsg = JSON.stringify({
            type: "game_update",
            payload: {
                paddles: state.paddles,
                ball: { x: ball.x, y: ball.y, dx: ball.dx, dy: ball.dy }
            }
        });

        sockets.forEach(sock => sock?.send(updateMsg));
    }, 1000 / FPS);

    return gameRoom.loop;
}

export function stopGameLoop(gameRoom: GameRoom) {
    if (gameRoom.loop) {
        clearInterval(gameRoom.loop);
        gameRoom.loop = null;
    }
    gameRoom.status = GAME_ROOM_STATUS.FINISHED;
}

interface RemoteGameInput {
    up: boolean;
    down: boolean;
}

interface LocalGameInput {
    left: RemoteGameInput;
    right: RemoteGameInput;
}


export interface GameUpdatePayload {
    gameId: string;
    playerId: string;
    input: LocalGameInput | RemoteGameInput;
}

function isLocalGameInput(input: any): input is LocalGameInput {
    return input && "left" in input && "right" in input;
}

export function gameUpdate(playerId: string, payload: GameUpdatePayload) {
    const { gameId, input } = payload;
    const gameRoom = games.get(gameId);
    if (!gameRoom || gameRoom.status !== GAME_ROOM_STATUS.ONGOING) return;

    if (gameRoom.mode === GAME_ROOM_MODE.LOCAL && playerId === gameRoom.p1) {
        if (isLocalGameInput(input)) {
            gameRoom.state.paddles.left.up = input.left.up;
            gameRoom.state.paddles.left.down = input.left.down;

            gameRoom.state.paddles.right.up = input.right.up;
            gameRoom.state.paddles.right.down = input.right.down;
        }
        return;
    }

    if (!isLocalGameInput(input)) {
        if (playerId === gameRoom.p1) {
            gameRoom.state.paddles.left.up = input.up;
            gameRoom.state.paddles.left.down = input.down;
        } else if (playerId === gameRoom.p2) {
            gameRoom.state.paddles.right.up = input.up;
            gameRoom.state.paddles.right.down = input.down;
        }
    }
}