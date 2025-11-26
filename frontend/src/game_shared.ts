import { game_start } from "./game.js";
import { sendMessage, addMessageListener, removeMessageListener } from "./game_soket.js";

export let ctx: CanvasRenderingContext2D | null = null;
export let gameConfig: any = null;
export let gameState: any = null;
export let gameid: string = "";

let cleanupListeners: (() => void)[] = [];
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyupHandler: ((e: KeyboardEvent) => void) | null = null;

export function addCleanupListener(fn: () => void): void {
  cleanupListeners.push(fn);
}

export function cleanupGame(userId?: number, b: boolean = true): void {
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
  if (container) container.innerHTML = '';

  ctx = null;

  if (gameid && userId && b) {
    sendMessage("player_leave_match", { playerId: userId, gameId: gameid });
  }
}

export function setupKeyboardListeners(gameId: string, playerId: string, isAI: boolean = false, isRemote: boolean = false): void {
  const moves = (isAI || isRemote)
    ? { up: false, down: false }
    : { left: { up: false, down: false }, right: { up: false, down: false } };

  console.log(`⌨️ Setting up keyboard listeners (AI: ${isAI}, Remote: ${isRemote})`);

  keydownHandler = (event: KeyboardEvent) => {
    let changed = false;

    if (isAI || isRemote) {
      if (event.key === "w" || event.key === "W") {
        (moves as any).up = true;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).down = true;
        changed = true;
      }
    } else {
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
      if (event.key === "w" || event.key === "W") {
        (moves as any).up = false;
        changed = true;
      } else if (event.key === "s" || event.key === "S") {
        (moves as any).down = false;
        changed = true;
      }
    } else {
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

  const winner = msg.payload?.winner;
  let isPlayerWinner = false;
  let gameType: "local" | "ai" | "remote" = "local";

  if (isAI) {
    isPlayerWinner = winner === "player" || winner === userId || winner === userId.toString();
    gameType = "ai";
  } else if (isRemote) {
    isPlayerWinner = winner === userId || winner === userId.toString();
    gameType = "remote";
  } else {
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

function showGameOverOverlay(
  isWinner: boolean,
  gameType: "local" | "ai" | "remote",
  navigateCallback: (path: string) => void,
  isPlayer2Winner: boolean = false
): void {
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
    } else {
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
    } else {
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

export function handleGameConfig(msg: any, userId: number, startButtonId: string, isAI: boolean = false, isRemote: boolean = false): void {
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
  console.log("paddles: ", gameState.paddles);
      const rid = gameState.paddles.right.playerId;
      const lid = gameState.paddles.left.playerId;

      const rImg = document.getElementById("r-palyer") as HTMLImageElement | null;
      const rName = document.getElementById("r-name") as HTMLElement | null;
      const lImg = document.getElementById("opponent-avatar") as HTMLImageElement | null;
      const lName = document.getElementById("opponent-name") as HTMLElement | null;
      console.log("user : ", fetchUserDetails(rid));
      if (String(userId) != String(lid)) {
        console.log(`lifte user [${userId}] name [${lName}]`);
        if (rImg && lImg) {
          const tmpSrc = lImg.src;
          const tmpAlt = lImg.alt;
          const tmpClass = lImg.className;
          const tmpOpacity = lImg.style.opacity;
          const tmpBorder = lImg.style.borderColor;

          lImg.src = rImg.src;
          lImg.alt = rImg.alt;
          lImg.className = rImg.className;
          lImg.style.opacity = rImg.style.opacity;
          lImg.style.borderColor = rImg.style.borderColor;

          rImg.src = tmpSrc;
          rImg.alt = tmpAlt;
          rImg.className = tmpClass;
          rImg.style.opacity = tmpOpacity;
          rImg.style.borderColor = tmpBorder;
        }

        if (rName && lName) {
          // swap text and basic styling
          const tmpText = lName.textContent;
          const tmpClass = lName.className;
          const tmpColor = lName.style.color;

          lName.textContent = rName.textContent;
          lName.className = rName.className;
          lName.style.color = rName.style.color;

          rName.textContent = tmpText;
          rName.className = tmpClass;
          rName.style.color = tmpColor;
        }
      }


  gameid = msg.payload.gameId;
  console.log(`🎮 Game ID: ${msg.payload.gameId}${isAI ? ' (AI Mode)' : isRemote ? ' (Remote Mode)' : ''}`);

  const container = document.getElementById("game-container")!;
  let canvas = document.getElementById("game-id") as HTMLCanvasElement;

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "game-id";
    canvas.width = gameConfig.canvas.width;
    canvas.height = gameConfig.canvas.height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.borderRadius = "12px";
    canvas.style.border = "2px solid rgba(255,255,255,0.1)";
    container.appendChild(canvas);
  }

  ctx = canvas.getContext("2d");
  if (ctx) {
    console.log("🎮 Starting game canvas");

    const startBtn = document.getElementById(startButtonId) as HTMLButtonElement;
    if (startBtn) {
      const newBtn = startBtn.cloneNode(true) as HTMLButtonElement;
      startBtn.parentNode?.replaceChild(newBtn, startBtn);
      newBtn.innerHTML = "✅ Ready - Click to Start!";
      newBtn.disabled = false;
      newBtn.style.background = "#10b981";
      newBtn.style.cursor = "pointer";
      const readyHandler = () => {
      console.log("🚀 Ready button clicked!");
      sendMessage("player_ready", { gameId: gameid, playerId: userId.toString() });
      setupKeyboardListeners(gameid, userId.toString(), isAI, isRemote);
              newBtn.innerHTML = "🎮 Playing...";
        newBtn.disabled = true;
        newBtn.style.opacity = "0.5";

        console.log("⌨️ Game controls active - Use W/S keys");
      };
      newBtn.addEventListener('click', readyHandler);
      addCleanupListener(() => {
        newBtn.removeEventListener('click', readyHandler);
      });
    }
    console.log("💡 Canvas ready! Click the button to start!");
  }
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
      handleGameConfig(msg, userId, "start-local-game", false);
    }
  };
}

export function createAIGameListener(userId: number): (msg: any) => void {
  return (msg: any) => {
    if (!msg) return;

    if (msg.type === "join_ai-opponent_ack") {
      const startBtn = document.getElementById("start-ai-game") as HTMLButtonElement;
      if (startBtn) {
        const d_b = document.getElementById("ai_butin") ;
        if (d_b)
          d_b.classList.add("disabled-div");
        startBtn.innerHTML = "Connecting to AI...";
        startBtn.disabled = true;
      }
      const backBtn = document.getElementById("back-button-ai");
      if (backBtn) backBtn.classList.add("disabled-link");
    }
    else if (msg.type === "game_config") {
      handleGameConfig(msg, userId, "start-ai-game", true);
    }
    else if (msg.type === "game_start") {
      console.log("🚀 AI Game started!");
    }
  };
}

type FetchedUser = { id?: number; username?: string; avatar?: string } | null;

export  function  createRemoteGameListener(userId: number): (msg: any) => void {
  return (msg: any) => {
    if (!msg) return;

    console.log("🌐 Remote game message:", msg.type, msg.payload);
    let data:FetchedUser  = null;

    if (msg.type === "join_random_ack") {
      const startBtn = document.getElementById("start-remote-game") as HTMLButtonElement;
      if (startBtn) {
        startBtn.innerHTML = "Searching for opponent...";
        startBtn.disabled = true;
      }
      const backBtn = document.getElementById("back-button-remote");
      if (backBtn) backBtn.classList.add("disabled-link");


      const opponentImg = document.getElementById("opponent-avatar") as HTMLImageElement;
      if (opponentImg) {
        opponentImg.style.opacity = "0.5";
      }
    }
    else if (msg.type === "random_opponent_found") {
      console.log("🎮 Match found!", msg.payload);
      const id1 = msg.payload.player1;
      const id2 = msg.payload.player2;

      const opponentImg = document.getElementById("opponent-avatar") as HTMLImageElement;
      const opponentName = document.getElementById("opponent-name");
      const serchstate = document.getElementById("serch");
      if (serchstate){
        serchstate.innerHTML = "● Online";
        serchstate.style.color="#10b981";
      }

      if (String(userId) === String(id1)) {
        fetchUserDetails(id2)
          .then(res => {
        if (!res) {
          console.error("failed to get user data by id");
          return;
        }
        if (opponentImg) {
        opponentImg.src = res.avatar;
        opponentImg.style.opacity = "1";
        opponentImg.style.borderColor = "#10b981";
        }
        if (opponentName) {
          opponentName.textContent = res.username;
          opponentName.style.color = "#e5e7eb";
        }
          })
          .catch(e => console.error(e));
      } else {
        fetchUserDetails(id1)
          .then(res => {
        if (!res) {
          console.error("failed to get user data by id");
          return;
        }
        if (opponentImg) {
        opponentImg.src = res.avatar;
        opponentImg.style.opacity = "1";
        opponentImg.style.borderColor = "#10b981";
        }
        if (opponentName) {
          opponentName.textContent = res.username;
          opponentName.style.color = "#e5e7eb";
        }
          })
          .catch(e => console.error(e));
      }


      const startBtn = document.getElementById("start-remote-game");
      if (startBtn) startBtn.innerHTML = "Match found! Starting...";

      const matchmakingStatus = document.getElementById("matchmaking-status");
      if (matchmakingStatus) matchmakingStatus.style.display = "none";
    }
    else if (msg.type === "game_config") {
      console.log("🎮 Remote game config received");
      handleGameConfig(msg, userId, "start-remote-game", false, true);
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

export function setupGameListeners(
  gameListener: (msg: any) => void,
  scoreElementId: string,
  userId: number,
  loadPageCallback: (path: string) => void,
  isAI: boolean = false,
  isRemote: boolean = false
): void {
  const updateHandler = (msg: any): void => handleGameUpdate(msg, scoreElementId);

  const finishHandler = (msg: any): void => {
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

export function cleanupTournamentPage(): void {
  console.log("🧹 Cleaning up tournament page (keeping tournament active)...");

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
  if (container) container.innerHTML = '';

  ctx = null;

}

export function setupTournamentNavigationHandlers(
  userId: number,
  tournamentId: string,
  loadPageCallback: (path: string) => void
): void {

  sessionStorage.setItem('inTournamentLobby', tournamentId);

  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    console.log("🔄 Page unloading (refresh/close) - not sending leave message");
  };


  const popstateHandler = () => {
    const tournamentId = sessionStorage.getItem('inTournamentLobby');

    if (tournamentId && !window.location.pathname.includes('tournament/lobby')) {
      console.log("🚪 Navigating away from tournament - leaving...");
      sessionStorage.removeItem('inTournamentLobby');

      fetch('/tournaments/tournaments/leave', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tournamentId })
      }).catch(console.error);
    }

    cleanupTournamentPage();
    loadPageCallback(window.location.pathname.replace(/^\//, "") || "home");
  };

  window.addEventListener("popstate", popstateHandler);
  addCleanupListener(() => window.removeEventListener("popstate", popstateHandler));
}


export async function fetchUserDetails(userId: string | number): Promise<any> {
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      console.warn("No token found for fetchUserDetails");
      return null;
    }

    const res = await fetch(`/api/user/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`Error fetching details for user ${userId}:`, error);
    return null;
  }
}

