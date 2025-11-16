// src/game_shared.ts
import { game_start } from "./game.js";
import { sendMessage, addMessageListener, removeMessageListener } from "./game_soket.js";

// ============================================
// SHARED STATE
// ============================================
export let ctx: CanvasRenderingContext2D | null = null;
export let gameConfig: any = null;
export let gameState: any = null;
export let gameid: string = "";

// Cleanup listeners array
let cleanupListeners: (() => void)[] = [];
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyupHandler: ((e: KeyboardEvent) => void) | null = null;

// ============================================
// CLEANUP FUNCTIONS
// ============================================
export function addCleanupListener(fn: () => void): void {
  cleanupListeners.push(fn);
}

export function cleanupGame(userId?: number, b: boolean = true): void {
  console.log("🧹 Cleaning up game...");

  // Execute all cleanup listeners
  cleanupListeners.forEach(cleanup => cleanup());
  cleanupListeners = [];

  // Remove keyboard handlers
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (keyupHandler) {
    document.removeEventListener("keyup", keyupHandler);
    keyupHandler = null;
  }

  // Clear canvas
  const container = document.getElementById("game-container");
  if (container) container.innerHTML = '';

  // Reset context
  ctx = null;

  // Notify server if needed
  if (gameid && userId && b) {
    sendMessage("player_leave_match", { playerId: userId, gameId: gameid });
  }
}

// ============================================
// KEYBOARD SETUP
// ============================================
export function setupKeyboardListeners(gameId: string, playerId: string, isAI: boolean = false, isRemote: boolean = false): void {
  // For AI/Remote mode: only send player's paddle input as { up, down }
  // For local mode: send both paddles as { left: {...}, right: {...} }
  const moves = (isAI || isRemote)
    ? { up: false, down: false }
    : { left: { up: false, down: false }, right: { up: false, down: false } };

  console.log(`⌨️ Setting up keyboard listeners (AI: ${isAI}, Remote: ${isRemote})`);

  keydownHandler = (event: KeyboardEvent) => {
    let changed = false;

    if (isAI || isRemote) {
      // AI/Remote mode: only control player paddle with simple up/down
      if (event.key === "w" || event.key === "W") {
        (moves as any).up = true;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).down = true;
        changed = true;
      }
    } else {
      // Local mode: control both paddles
      if (event.key === "ArrowUp") {
        (moves as any).right.up = true;
        changed = true;
      } else if (event.key === "ArrowDown") {
        (moves as any).right.down = true;
        changed = true;
      } else if (event.key === "w" || event.key === "W") {
        (moves as any).left.up = true;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).left.down = true;
        changed = true;
      }
    }

    if (changed) {
      console.log(`🎮 Sending input (AI: ${isAI}, Remote: ${isRemote}):`, moves);
      sendMessage("game_update", { gameId, playerId, input: { ...moves } });
    }
  };

  keyupHandler = (event: KeyboardEvent) => {
    let changed = false;

    if (isAI || isRemote) {
      // AI/Remote mode: only control player paddle
      if (event.key === "w" || event.key === "W") {
        (moves as any).up = false;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).down = false;
        changed = true;
      }
    } else {
      // Local mode: control both paddles
      if (event.key === "ArrowUp") {
        (moves as any).right.up = false;
        changed = true;
      } else if (event.key === "ArrowDown") {
        (moves as any).right.down = false;
        changed = true;
      } else if (event.key === "w" || event.key === "W") {
        (moves as any).left.up = false;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).left.down = false;
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

// ============================================
// SHARED MESSAGE HANDLERS
// ============================================
export function handleGameUpdate(msg: any, scoreElementId: string = 'local-score'): void {
  if (msg.type !== "game_update" || !gameConfig || !ctx) return;

  gameState.paddles = msg.payload.paddles;
  gameState.ball = msg.payload.ball;

  const scoreEl = document.getElementById(scoreElementId);
  if (scoreEl) {
    scoreEl.innerHTML = `${gameState.paddles.left.score} - ${gameState.paddles.right.score}`;
  }

  ctx.clearRect(0, 0, gameConfig.canvas.width, gameConfig.canvas.height);
  game_start(gameConfig, gameState, ctx);
}
export function handleGameFinish(
  msg: any,
  scoreElementId: string,
  userId: number,
  navigateCallback: (path: string) => void,
  isAI: boolean = false,
  isRemote: boolean = false
): void {
  if (msg.type !== "game_finish") return;

  console.log("🏁 Game finished!", msg.payload);

  // Determine if player won based on game type and winner value
  const winner = msg.payload?.winner;
  let isPlayerWinner = false;
  let gameType: "local" | "ai" | "remote" = "local";  // ✅ Change this line - add type annotation

  if (isAI) {
    // AI game: winner is "player" or userId means player won
    isPlayerWinner = winner === "player" || winner === userId || winner === userId.toString();
    gameType = "ai";
  } else if (isRemote) {
    // Remote game: winner is userId means player won
    isPlayerWinner = winner === userId || winner === userId.toString();
    gameType = "remote";
  } else {
    // Local game: winner is userId means player 1 won, "local" means player 2 won
    isPlayerWinner = winner === userId || winner === userId.toString();
    gameType = "local";
  }

  console.log(`Winner: ${winner}, Is Player Winner: ${isPlayerWinner}, User ID: ${userId}, Game Type: ${gameType}`);

  // Clean up keyboard listeners
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (keyupHandler) {
    document.removeEventListener("keyup", keyupHandler);
    keyupHandler = null;
  }

  // Clear the canvas
  if (ctx && gameConfig) {
    ctx.clearRect(0, 0, gameConfig.canvas.width, gameConfig.canvas.height);
  }

  // Show game over overlay with game type for proper redirect
  showGameOverOverlay(isPlayerWinner, gameType, navigateCallback, winner === "local");
}

// ============================================
// GAME OVER OVERLAY
// ============================================
function showGameOverOverlay(
  isWinner: boolean,
  gameType: "local" | "ai" | "remote",
  navigateCallback: (path: string) => void,
  isPlayer2Winner: boolean = false
): void {
  // Create overlay
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

  // Add CSS animation
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
    // ============================================
    // AI GAME - WIN/LOSE
    // ============================================
    if (isWinner) {
      // Player won against AI
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
    } else {
      // Player lost against AI
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
  } else if (gameType === "remote") {
    // ============================================
    // REMOTE GAME - WIN/LOSE
    // ============================================
    if (isWinner) {
      // Player won remote match
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
    } else {
      // Player lost remote match
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
  } else {
    // ============================================
    // LOCAL GAME - PLAYER 1 or PLAYER 2 WINS
    // ============================================
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

  // Add confetti effect for winners
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

  // Auto-redirect after 3 seconds
  setTimeout(() => {
    overlay.remove();
    style.remove();
    cleanupGame(undefined, false);

    // Redirect based on game type
    const redirectPath = `dashboard/game/${gameType}`;
    console.log(`🔄 Redirecting to: ${redirectPath}`);
    history.pushState({}, "", `/${redirectPath}`);
    navigateCallback(redirectPath);
  }, 3000); // 3 seconds
}

// ============================================
// GAME CONFIG HANDLER (shared by local & AI)
// ============================================
function handleGameConfig(msg: any, userId: number, startButtonId: string, isAI: boolean = false, isRemote: boolean = false): void {
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

  // Create canvas (with duplicate check)
  const container = document.getElementById("game-container")!;
  let canvas = document.getElementById("game-id") as HTMLCanvasElement;

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
    if (startBtn) startBtn.innerHTML = "";

      startCanvasCountdown(ctx, canvas).then(() => {
        if (ctx)
          game_start(gameConfig, gameState, ctx);

        // Enable keyboard after countdown
        setupKeyboardListeners(gameid, userId.toString(), isAI, isRemote);
      });


    // Attach keyboard listeners (pass isAI and isRemote flags)
    setupKeyboardListeners(gameid, userId.toString(), isAI, isRemote);
  }
}


function startCanvasCountdown(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve) => {
    let count = 3;

    const interval = setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Countdown style
      ctx.fillStyle = "white";
      ctx.font = "bold 80px Arial";
      ctx.textAlign = "center";
      ctx.fillText(count.toString(), canvas.width / 2, canvas.height / 2);

      if (count === 1) {
        // Show GO! then start game
        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillText("GO!", canvas.width / 2, canvas.height / 2);
        }, 800);
      }

      if (count === 0) {
        clearInterval(interval);

        // Clear countdown and resolve
        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          resolve();
        }, 500);
      }

      count--;
    }, 1000);
  });
}


export function createLocalGameListener(userId: number): (msg: any) => void {
  return (msg: any) => {
    if (!msg) return;

    if (msg.type === "join_local_ack") {
      const startBtn = document.getElementById("start-local-game") as HTMLButtonElement;
      if (startBtn) {
        startBtn.innerHTML = "Starting local game...";
        startBtn.disabled = true;
      }
      const backBtn = document.getElementById("back-button");
      if (backBtn) backBtn.classList.add("disabled-link");
    }
    else if (msg.type === "game_config") {
      handleGameConfig(msg, userId, "start-local-game", false); // false = not AI mode
    }
  };
}

export function createAIGameListener(userId: number): (msg: any) => void {
  return (msg: any) => {
    if (!msg) return;

    if (msg.type === "join_ai-opponent_ack") {
      const startBtn = document.getElementById("start-ai-game") as HTMLButtonElement;
      if (startBtn) {
        startBtn.innerHTML = "Connecting to AI...";
        startBtn.disabled = true;
      }
      const backBtn = document.getElementById("back-button-ai");
      if (backBtn) backBtn.classList.add("disabled-link");
    }
    else if (msg.type === "game_config") {
      handleGameConfig(msg, userId, "start-ai-game", true); // true = AI mode
    }
    else if (msg.type === "game_start") {
      console.log("🚀 AI Game started!");
      // Keyboard already setup in handleGameConfig
    }
  };
}

export function createRemoteGameListener(userId: number): (msg: any) => void {
  return (msg: any) => {
    if (!msg) return;

    if (msg.type === "join_random_ack") {
      const startBtn = document.getElementById("start-remote-game") as HTMLButtonElement;
      if (startBtn) {
        startBtn.innerHTML = "Searching for opponent...";
        startBtn.disabled = true;
      }
      const backBtn = document.getElementById("back-button-remote");
      if (backBtn) backBtn.classList.add("disabled-link");

      // Show searching animation
      const opponentImg = document.getElementById("opponent-avatar");
      if (opponentImg) {
        (opponentImg as HTMLImageElement).src = "../images/searching.gif"; // You'll need this GIF
      }
    }
    else if (msg.type === "match_found") {
      console.log("🎮 Match found!", msg.payload);
      const opponentInfo = msg.payload.opponent;

      // Update opponent UI
      const opponentImg = document.getElementById("opponent-avatar") as HTMLImageElement;
      const opponentName = document.getElementById("opponent-name");

      if (opponentImg && opponentInfo?.avatar) {
        opponentImg.src = opponentInfo.avatar;
      }
      if (opponentName && opponentInfo?.username) {
        opponentName.textContent = opponentInfo.username;
      }

      const startBtn = document.getElementById("start-remote-game");
      if (startBtn) startBtn.innerHTML = "Match found! Starting...";
    }
    else if (msg.type === "game_config") {
      handleGameConfig(msg, userId, "start-remote-game", false, true); // Remote game - isAI=false, isRemote=true
    }
    else if (msg.type === "game_start") {
      console.log("🚀 Remote game started!");
    }
  };
}
export function setupNavigationHandlers(
  userId: number,
  backButtonId: string,
  loadPageCallback: (path: string) => void
): void {
  // Back button
  const backBtn = document.getElementById(backButtonId);
  if (backBtn) {
    const backHandler = (e: Event) => {
      e.preventDefault();
      cleanupGame(userId);
      history.pushState({}, "", "/dashboard/game");
      loadPageCallback("dashboard/game");
    };
    backBtn.addEventListener("click", backHandler);
    addCleanupListener(() => backBtn.removeEventListener("click", backHandler));
  }

  // Browser back/forward button
  const popstateHandler = () => {
    cleanupGame(userId);
    loadPageCallback(window.location.pathname.replace(/^\//, "") || "home");
  };
  window.addEventListener("popstate", popstateHandler);
  addCleanupListener(() => window.removeEventListener("popstate", popstateHandler));

  // Page refresh/close
  const beforeUnloadHandler = () => {
    if (gameid && userId) {
      sendMessage("player_leave_match", { playerId: userId, gameId: gameid });
    }
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);
  addCleanupListener(() => window.removeEventListener("beforeunload", beforeUnloadHandler));
}

// ============================================
// SETUP MESSAGE LISTENERS
// ============================================
export function setupGameListeners(
  gameListener: (msg: any) => void,
  scoreElementId: string,
  userId: number,
  loadPageCallback: (path: string) => void,
  isAI: boolean = false,
  isRemote: boolean = false  // ✅ Add this parameter
): void {
  // Create update handler
  const updateHandler = (msg: any): void => handleGameUpdate(msg, scoreElementId);

  // Create finish handler with proper typing
  const finishHandler = (msg: any): void => {
    handleGameFinish(msg, scoreElementId, userId, loadPageCallback, isAI, isRemote);  // ✅ Pass isRemote
  };

  // Add all listeners
  addMessageListener(gameListener);
  addMessageListener(updateHandler);
  addMessageListener(finishHandler);

  // Register cleanup
  addCleanupListener(() => {
    removeMessageListener(gameListener);
    removeMessageListener(updateHandler);
    removeMessageListener(finishHandler);
  });
}