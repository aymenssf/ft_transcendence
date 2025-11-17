import {initgameSocket, sendMessage, removeMessageListener, addMessageListener } from "./game_soket.js"

export function game_start(config: any, state: any, ctx: CanvasRenderingContext2D) {
    const { canvas: c, paddle, ball } = config;
    const { paddles, ball: ballPos } = state;
    ctx.clearRect(0, 0, c.width, c.height);


    ctx.beginPath();
    ctx.fillStyle = paddle.color;
    ctx.roundRect(paddles.left.x, paddles.left.y, paddle.width, paddle.height, 10);
    ctx.fill();
    ctx.closePath();


    ctx.beginPath();
    ctx.fillStyle = paddle.color;
    ctx.roundRect(paddles.right.x, paddles.right.y, paddle.width, paddle.height, 10);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.fillStyle = ball.color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.arc(ballPos.x, ballPos.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
}

export function listenForInputLocal(gameId: string, playerId: string) {
    const moves = { left: { up: false, down: false }, right: { up: false, down: false } };
    console.log("listen for input");
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowUp") {
            moves.right.up = true;
        } else if (event.key === "ArrowDown") {
            moves.right.down = true;
        } else if (event.key === "w") {
            moves.left.up = true;
        } else if (event.key === "s") {
            moves.left.down = true;
        } else return;

        sendMessage("game_update", { gameId, playerId, input: { ...moves } });
    }

    function handleKeyUp(event: KeyboardEvent) {
        if (event.key === "ArrowUp") {
            moves.right.up = false;
        } else if (event.key === "ArrowDown") {
            moves.right.down = false;
        } else if (event.key === "w") {
            moves.left.up = false;
        } else if (event.key === "s") {
            moves.left.down = false;
        } else return;

        sendMessage("game_update", { gameId, playerId, input: { ...moves } });
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
    };
}