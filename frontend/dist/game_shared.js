import { game_start } from "./game.js";
import { sendMessage, addMessageListener, removeMessageListener } from "./game_soket.js";
export let ctx = null;
export let gameConfig = null;
export let gameState = null;
export let gameid = "";
let cleanupListeners = [];
let keydownHandler = null;
let keyupHandler = null;
export function addCleanupListener(fn) {
    cleanupListeners.push(fn);
}
export function cleanupGame(userId, b = true) {
    console.log("🧹 Cleaning up game...");
    cleanupListeners.forEach(cleanup => cleanup());
    cleanupListeners = [];
    if (keydownHandler) {
        document.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        document.removeEventListener("keyup", keyupHandler);
        keyupHandler = null;
    }
    const container = document.getElementById("game-container");
    if (container)
        container.innerHTML = '';
    ctx = null;
    if (gameid && userId && b) {
        sendMessage("player_leave_match", { playerId: userId, gameId: gameid });
    }
}
export function setupKeyboardListeners(gameId, playerId, isAI = false, isRemote = false) {
    const moves = (isAI || isRemote)
        ? { up: false, down: false }
        : { left: { up: false, down: false }, right: { up: false, down: false } };
    console.log(`⌨️ Setting up keyboard listeners (AI: ${isAI}, Remote: ${isRemote})`);
    keydownHandler = (event) => {
        let changed = false;
        if (isAI || isRemote) {
            if (event.key === "w" || event.key === "W") {
                moves.up = true;
                changed = true;
            }
            else if (event.key === "s" || event.key === "S") {
                moves.down = true;
                changed = true;
            }
        }
        else {
            if (event.key === "ArrowUp") {
                moves.right.up = true;
                changed = true;
            }
            else if (event.key === "ArrowDown") {
                moves.right.down = true;
                changed = true;
            }
            else if (event.key === "w" || event.key === "W") {
                moves.left.up = true;
                changed = true;
            }
            else if (event.key === "s" || event.key === "S") {
                moves.left.down = true;
                changed = true;
            }
        }
        if (changed) {
            console.log(`🎮 Sending input (AI: ${isAI}, Remote: ${isRemote}):`, moves);
            sendMessage("game_update", { gameId, playerId, input: { ...moves } });
        }
    };
    keyupHandler = (event) => {
        let changed = false;
        if (isAI || isRemote) {
            if (event.key === "w" || event.key === "W") {
                moves.up = false;
                changed = true;
            }
            else if (event.key === "s" || event.key === "S") {
                moves.down = false;
                changed = true;
            }
        }
        else {
            if (event.key === "ArrowUp") {
                moves.right.up = false;
                changed = true;
            }
            else if (event.key === "ArrowDown") {
                moves.right.down = false;
                changed = true;
            }
            else if (event.key === "w" || event.key === "W") {
                moves.left.up = false;
                changed = true;
            }
            else if (event.key === "s" || event.key === "S") {
                moves.left.down = false;
                changed = true;
            }
        }
        if (changed) {
            console.log(`🎮 Sending input (AI: ${isAI}, Remote: ${isRemote}):`, moves);
            sendMessage("game_update", { gameId, playerId, input: { ...moves } });
        }
    };
    document.addEventListener("keydown", keydownHandler);
    document.addEventListener("keyup", keyupHandler);
}
export function handleGameUpdate(msg, scoreElementId = 'local-score') {
    if (msg.type !== "game_update" || !gameConfig || !ctx)
        return;
    gameState.paddles = msg.payload.paddles;
    gameState.ball = msg.payload.ball;
    const scoreEl = document.getElementById(scoreElementId);
    if (scoreEl) {
        scoreEl.innerHTML = `${gameState.paddles.left.score} - ${gameState.paddles.right.score}`;
    }
    ctx.clearRect(0, 0, gameConfig.canvas.width, gameConfig.canvas.height);
    game_start(gameConfig, gameState, ctx);
}
export function handleGameFinish(msg, scoreElementId, userId, navigateCallback, isAI = false, isRemote = false) {
    if (msg.type !== "game_finish")
        return;
    console.log("🏁 Game finished!", msg.payload);
    const winner = msg.payload?.winner;
    let isPlayerWinner = false;
    let gameType = "local";
    if (isAI) {
        isPlayerWinner = winner === "player" || winner === userId || winner === userId.toString();
        gameType = "ai";
    }
    else if (isRemote) {
        isPlayerWinner = winner === userId || winner === userId.toString();
        gameType = "remote";
    }
    else {
        isPlayerWinner = winner === userId || winner === userId.toString();
        gameType = "local";
    }
    console.log(`Winner: ${winner}, Is Player Winner: ${isPlayerWinner}, User ID: ${userId}, Game Type: ${gameType}`);
    if (keydownHandler) {
        document.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        document.removeEventListener("keyup", keyupHandler);
        keyupHandler = null;
    }
    if (ctx && gameConfig) {
        ctx.clearRect(0, 0, gameConfig.canvas.width, gameConfig.canvas.height);
    }
    showGameOverOverlay(isPlayerWinner, gameType, navigateCallback, winner === "local");
}
function showGameOverOverlay(isWinner, gameType, navigateCallback, isPlayer2Winner = false) {
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.5s ease-in;
  `;
    const style = document.createElement('style');
    style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(-100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes confetti {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
    }
  `;
    document.head.appendChild(style);
    let content = '';
    if (gameType === "ai") {
        if (isWinner) {
            content = `
        <div style="text-align: center; animation: slideDown 0.8s ease-out;">
          <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">
            🎉
          </div>
          <h1 style="font-size: 60px; color: #10b981; font-weight: bold; margin: 20px 0; text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);">
            YOU WIN!
          </h1>
          <p style="font-size: 24px; color: #d1d5db; margin: 20px 0;">
            You defeated the AI! 🤖
          </p>
          <p style="font-size: 18px; color: #9ca3af; margin-bottom: 40px;">
            Your skills are impressive!
          </p>
        </div>
      `;
        }
        else {
            content = `
        <div style="text-align: center; animation: slideDown 0.8s ease-out;">
          <div style="font-size: 80px; margin-bottom: 20px;">
            😢
          </div>
          <h1 style="font-size: 60px; color: #ef4444; font-weight: bold; margin: 20px 0; text-shadow: 0 0 20px rgba(239, 68, 68, 0.5);">
            YOU LOSE!
          </h1>
          <p style="font-size: 24px; color: #d1d5db; margin: 20px 0;">
            The AI was too strong this time... 🤖
          </p>
          <p style="font-size: 18px; color: #9ca3af; margin-bottom: 40px;">
            Don't give up! Try again!
          </p>
        </div>
      `;
        }
    }
    else if (gameType === "remote") {
        if (isWinner) {
            content = `
        <div style="text-align: center; animation: slideDown 0.8s ease-out;">
          <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">
            🏆
          </div>
          <h1 style="font-size: 60px; color: #10b981; font-weight: bold; margin: 20px 0; text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);">
            YOU WIN!
          </h1>
          <p style="font-size: 24px; color: #d1d5db; margin: 20px 0;">
            Victory! You defeated your opponent! 🎮
          </p>
          <p style="font-size: 18px; color: #9ca3af; margin-bottom: 40px;">
            Great match!
          </p>
        </div>
      `;
        }
        else {
            content = `
        <div style="text-align: center; animation: slideDown 0.8s ease-out;">
          <div style="font-size: 80px; margin-bottom: 20px;">
            😔
          </div>
          <h1 style="font-size: 60px; color: #ef4444; font-weight: bold; margin: 20px 0; text-shadow: 0 0 20px rgba(239, 68, 68, 0.5);">
            YOU LOSE!
          </h1>
          <p style="font-size: 24px; color: #d1d5db; margin: 20px 0;">
            Your opponent was too good this time... 🎮
          </p>
          <p style="font-size: 18px; color: #9ca3af; margin-bottom: 40px;">
            Better luck next time!
          </p>
        </div>
      `;
        }
    }
    else {
        const winnerText = isPlayer2Winner ? "PLAYER 2 WINS!" : "PLAYER 1 WINS!";
        const winnerColor = isPlayer2Winner ? "#ef4444" : "#3b82f6";
        content = `
      <div style="text-align: center; animation: slideDown 0.8s ease-out;">
        <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">
          🏆
        </div>
        <h1 style="font-size: 60px; color: ${winnerColor}; font-weight: bold; margin: 20px 0; text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);">
          ${winnerText}
        </h1>
        <p style="font-size: 24px; color: #d1d5db; margin: 20px 0;">
          Great game! 🎮
        </p>
      </div>
    `;
    }
    overlay.innerHTML = content;
    if (isWinner || gameType === "local") {
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: ${['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)]};
        top: -20px;
        left: ${Math.random() * 100}%;
        animation: confetti ${2 + Math.random() * 2}s linear;
        animation-delay: ${Math.random() * 0.5}s;
      `;
            overlay.appendChild(confetti);
        }
    }
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.remove();
        style.remove();
        cleanupGame(undefined, false);
        const redirectPath = `dashboard/game/${gameType}`;
        console.log(`🔄 Redirecting to: ${redirectPath}`);
        history.pushState({}, "", `/${redirectPath}`);
        navigateCallback(redirectPath);
    }, 3000);
}
function handleGameConfig(msg, userId, startButtonId, isAI = false, isRemote = false) {
    gameConfig = {
        gameId: msg.payload.gameId,
        mode: msg.payload.mode,
        difficulty: msg.payload.difficulty || null,
        tournamentId: msg.payload.tournamentId || null,
        canvas: msg.payload.canvas,
        paddle: msg.payload.paddle,
        ball: {
            radius: msg.payload.ball.radius,
            color: msg.payload.ball.color,
        },
    };
    gameState = {
        paddles: msg.payload.paddles,
        ball: {
            x: msg.payload.ball.x,
            y: msg.payload.ball.y,
        },
    };
    gameid = msg.payload.gameId;
    console.log(`🎮 Game ID: ${msg.payload.gameId}${isAI ? ' (AI Mode)' : isRemote ? ' (Remote Mode)' : ''}`);
    const container = document.getElementById("game-container");
    let canvas = document.getElementById("game-id");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "game-id";
        canvas.width = gameConfig.canvas.width;
        canvas.height = gameConfig.canvas.height;
        canvas.style.backgroundColor = gameConfig.canvas.color;
        container.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
    if (ctx) {
        console.log("🎮 Starting game canvas");
        const startBtn = document.getElementById(startButtonId);
        if (startBtn)
            startBtn.innerHTML = "";
        startCanvasCountdown(ctx, canvas).then(() => {
            if (ctx)
                game_start(gameConfig, gameState, ctx);
            setupKeyboardListeners(gameid, userId.toString(), isAI, isRemote);
        });
        setupKeyboardListeners(gameid, userId.toString(), isAI, isRemote);
    }
}
function startCanvasCountdown(ctx, canvas) {
    return new Promise((resolve) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.fillText("READY", canvas.width / 2, canvas.height / 2);
        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillText("GO!", canvas.width / 2, canvas.height / 2);
            setTimeout(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                resolve();
            }, 2000);
        }, 1000);
    });
}
export function createLocalGameListener(userId) {
    return (msg) => {
        if (!msg)
            return;
        if (msg.type === "join_local_ack") {
            const startBtn = document.getElementById("start-local-game");
            if (startBtn) {
                startBtn.innerHTML = "Starting local game...";
                startBtn.disabled = true;
            }
            const backBtn = document.getElementById("back-button");
            if (backBtn)
                backBtn.classList.add("disabled-link");
        }
        else if (msg.type === "game_config") {
            handleGameConfig(msg, userId, "start-local-game", false);
        }
    };
}
export function createAIGameListener(userId) {
    return (msg) => {
        if (!msg)
            return;
        if (msg.type === "join_ai-opponent_ack") {
            const startBtn = document.getElementById("start-ai-game");
            if (startBtn) {
                startBtn.innerHTML = "Connecting to AI...";
                startBtn.disabled = true;
            }
            const backBtn = document.getElementById("back-button-ai");
            if (backBtn)
                backBtn.classList.add("disabled-link");
        }
        else if (msg.type === "game_config") {
            handleGameConfig(msg, userId, "start-ai-game", true);
        }
        else if (msg.type === "game_start") {
            console.log("🚀 AI Game started!");
        }
    };
}
export function createRemoteGameListener(userId) {
    return (msg) => {
        if (!msg)
            return;
        console.log("🌐 Remote game message:", msg.type, msg.payload);
        if (msg.type === "join_random_ack") {
            const startBtn = document.getElementById("start-remote-game");
            if (startBtn) {
                startBtn.innerHTML = "Searching for opponent...";
                startBtn.disabled = true;
            }
            const backBtn = document.getElementById("back-button-remote");
            if (backBtn)
                backBtn.classList.add("disabled-link");
            // Show searching animation
            const opponentImg = document.getElementById("opponent-avatar");
            if (opponentImg) {
                opponentImg.style.opacity = "0.5";
            }
        }
        else if (msg.type === "match_found") {
            console.log("🎮 Match found!", msg.payload);
            const opponentInfo = msg.payload.opponent;
            // Update opponent UI
            const opponentImg = document.getElementById("opponent-avatar");
            const opponentName = document.getElementById("opponent-name");
            if (opponentImg && opponentInfo?.avatar) {
                opponentImg.src = opponentInfo.avatar;
                opponentImg.style.opacity = "1";
                opponentImg.style.borderColor = "#10b981";
            }
            if (opponentName && opponentInfo?.username) {
                opponentName.textContent = opponentInfo.username;
                opponentName.style.color = "#e5e7eb";
            }
            const startBtn = document.getElementById("start-remote-game");
            if (startBtn)
                startBtn.innerHTML = "Match found! Starting...";
            // Hide matchmaking status
            const matchmakingStatus = document.getElementById("matchmaking-status");
            if (matchmakingStatus)
                matchmakingStatus.style.display = "none";
        }
        else if (msg.type === "game_config") {
            console.log("🎮 Remote game config received");
            handleGameConfig(msg, userId, "start-remote-game", false, true); // isAI=false, isRemote=true
        }
        else if (msg.type === "game_start") {
            console.log("🚀 Remote game started!");
        }
    };
}
export function setupNavigationHandlers(userId, backButtonId, loadPageCallback) {
    const backBtn = document.getElementById(backButtonId);
    if (backBtn) {
        const backHandler = (e) => {
            e.preventDefault();
            cleanupGame(userId);
            history.pushState({}, "", "/dashboard/game");
            loadPageCallback("dashboard/game");
        };
        backBtn.addEventListener("click", backHandler);
        addCleanupListener(() => backBtn.removeEventListener("click", backHandler));
    }
    const popstateHandler = () => {
        cleanupGame(userId);
        loadPageCallback(window.location.pathname.replace(/^\//, "") || "home");
    };
    window.addEventListener("popstate", popstateHandler);
    addCleanupListener(() => window.removeEventListener("popstate", popstateHandler));
    const beforeUnloadHandler = () => {
        if (gameid && userId) {
            sendMessage("player_leave_match", { playerId: userId, gameId: gameid });
        }
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    addCleanupListener(() => window.removeEventListener("beforeunload", beforeUnloadHandler));
}
export function setupGameListeners(gameListener, scoreElementId, userId, loadPageCallback, isAI = false, isRemote = false) {
    const updateHandler = (msg) => handleGameUpdate(msg, scoreElementId);
    const finishHandler = (msg) => {
        handleGameFinish(msg, scoreElementId, userId, loadPageCallback, isAI, isRemote);
    };
    addMessageListener(gameListener);
    addMessageListener(updateHandler);
    addMessageListener(finishHandler);
    addCleanupListener(() => {
        removeMessageListener(gameListener);
        removeMessageListener(updateHandler);
        removeMessageListener(finishHandler);
    });
}
