import { sendMessage } from "./game_soket.js";
export function game_start(config, state, ctx) {
    const { canvas: c, paddle, ball } = config;
    const { paddles, ball: ballPos } = state;
    ctx.clearRect(0, 0, c.width, c.height);
    // Left paddle
    ctx.beginPath();
    ctx.fillStyle = paddle.color;
    ctx.roundRect(paddles.left.x, paddles.left.y, paddle.width, paddle.height, 10);
    ctx.fill();
    ctx.closePath();
    // Right paddle
    ctx.beginPath();
    ctx.fillStyle = paddle.color;
    ctx.roundRect(paddles.right.x, paddles.right.y, paddle.width, paddle.height, 10);
    ctx.fill();
    ctx.closePath();
    // Ball
    ctx.beginPath();
    ctx.fillStyle = ball.color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.arc(ballPos.x, ballPos.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
}
export function listenForInputLocal(gameId, playerId) {
    const moves = { left: { up: false, down: false }, right: { up: false, down: false } };
    console.log("listen for input");
    function handleKeyDown(event) {
        if (event.key === "ArrowUp") {
            moves.right.up = true;
        }
        else if (event.key === "ArrowDown") {
            moves.right.down = true;
        }
        else if (event.key === "w") {
            moves.left.up = true;
        }
        else if (event.key === "s") {
            moves.left.down = true;
        }
        else
            return;
        sendMessage("game_update", { gameId, playerId, input: { ...moves } });
    }
    function handleKeyUp(event) {
        if (event.key === "ArrowUp") {
            moves.right.up = false;
        }
        else if (event.key === "ArrowDown") {
            moves.right.down = false;
        }
        else if (event.key === "w") {
            moves.left.up = false;
        }
        else if (event.key === "s") {
            moves.left.down = false;
        }
        else
            return;
        sendMessage("game_update", { gameId, playerId, input: { ...moves } });
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
    };
}
