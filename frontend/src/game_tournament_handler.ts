import { game_start } from "./game.js";
import { sendMessage, addMessageListener, removeMessageListener } from "./game_soket.js";
import { addCleanupListener } from "./game_shared.js";

let ctx: CanvasRenderingContext2D | null = null;
let gameConfig: any = null;
let gameState: any = null;
let gameId: string = "";
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyupHandler: ((e: KeyboardEvent) => void) | null = null;
let gameUpdateListener: ((msg: any) => void) | null = null;
let finalGameConfig: any = null;
let popstateHandler: any = null;
const getElement = (id: string) => document.getElementById(id);

export function cleanupTournamentMatch() {
  if (keydownHandler) window.removeEventListener("keydown", keydownHandler);
  if (keyupHandler) window.removeEventListener("keyup", keyupHandler);
  if (gameUpdateListener) removeMessageListener(gameUpdateListener);
  keydownHandler = keyupHandler = gameUpdateListener = null;
  ctx = null;
  if (popstateHandler)
    addCleanupListener(() => window.removeEventListener("popstate", popstateHandler));
}

const showView = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  if (el) el.classList.add('flex');
};

const hideView = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (el) el.classList.remove('flex');
};

async function fetchUserDetails(userId: string): Promise<{ username: string; avatar: string } | null> {
  try {
    const token = localStorage.getItem("jwt_token");
    const res = await fetch(`/api/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function setupInput(gId: string, pId: string) {
  const moves = { up: false, down: false };
  const send = () => sendMessage("game_update", { gameId: gId, playerId: pId, input: { ...moves } });

  keydownHandler = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "w") moves.up = true;
    if (e.key.toLowerCase() === "s") moves.down = true;
    send();
  };
  keyupHandler = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "w") moves.up = false;
    if (e.key.toLowerCase() === "s") moves.down = false;
    send();
  };
  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
}

export function createTournamentListener(
  userId: number,
  tournamentId: string,
  navigateCallback: (path: string) => void
) {
  const userIdStr = String(userId);
  let currentRound: "semi" | "final" | null = null;
  let round: "semi" | "final" | null = null;
  let myMatch: { p1: any; p2: any } | null = null;
  let isEliminated = false;
  let pendingFinalGameId: string | null = null;

  const resolveUser = async (pid: string) => {
    const pidStr = String(pid);
    const isMe = pidStr === userIdStr;
    let user = { name: `Player ${pidStr.substring(0, 4)}`, avatar: "../images/avatars/unknown.jpg", isMe, id: pidStr };
    const data = await fetchUserDetails(pidStr);
    if (data) {
      user.name = data.username;
      user.avatar = data.avatar || user.avatar;
    }
    return user;
  };

  popstateHandler = () => {
    cleanupTournamentMatch();
    localStorage.removeItem('activeTournamentId');
  };
  window.addEventListener("popstate", popstateHandler);

  const runCountdown = (timerId: string, seconds: number): Promise<void> => {
    return new Promise((resolve) => {
      let count = seconds;
      const timerEl = document.getElementById(timerId);
      if (timerEl) timerEl.textContent = String(count);

      const interval = setInterval(() => {
        count--;
        if (timerEl) timerEl.textContent = String(count);
        if (count <= 0) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  };

  const createMatchCardHTML = (p1: any, p2: any, label: string) => `
      <div class="card-base border-2 border-white/10 flex flex-col items-center p-8 min-w-[300px]">
        <h3 class="text-gray-400 text-sm mb-6 uppercase font-bold tracking-widest">${label}</h3>
        <div class="flex items-center justify-between w-full gap-6">
          <div class="flex flex-col items-center gap-3">
            <img src="${p1.avatar}" class="w-20 h-20 rounded-full border-4 ${p1.isMe ? "border-emerald-500 shadow-lg" : "border-gray-600"} object-cover">
            <span class="font-bold text-lg ${p1.isMe ? "text-emerald-400" : "text-white"}">${p1.name}</span>
          </div>
          <div class="text-3xl font-black text-gray-700">VS</div>
          <div class="flex flex-col items-center gap-3">
            <img src="${p2.avatar}" class="w-20 h-20 rounded-full border-4 ${p2.isMe ? "border-emerald-500 shadow-lg" : "border-gray-600"} object-cover">
            <span class="font-bold text-lg ${p2.isMe ? "text-emerald-400" : "text-white"}">${p2.name}</span>
          </div>
        </div>
      </div>
  `;

  const initGame = (config: any, leftPlayer: any, rightPlayer: any) => {
    cleanupTournamentMatch();

    gameConfig = {
      gameId: config.gameId,
      mode: config.mode,
      canvas: config.canvas,
      paddle: config.paddle,
      ball: config.ball,
    };
    gameState = { paddles: config.paddles, ball: config.ball };
    gameId = config.gameId;

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.innerHTML = "";
      const canvas = document.createElement("canvas");
      canvas.id = "game-canvas";
      canvas.width = gameConfig.canvas.width;
      canvas.height = gameConfig.canvas.height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.borderRadius = "12px";
      canvas.style.border = "2px solid rgba(255,255,255,0.1)";
      gameContainer.appendChild(canvas);
      ctx = canvas.getContext("2d");
    }

    setupInput(gameId, userIdStr);

    gameUpdateListener = (msg: any) => {
      if (msg.type === "game_update" && ctx) {
        gameState.paddles = msg.payload.paddles;
        gameState.ball = msg.payload.ball;
        const scoreEl = document.getElementById("tournament-score");
        if (scoreEl) scoreEl.textContent = `${gameState.paddles.left.score} - ${gameState.paddles.right.score}`;
        game_start(gameConfig, gameState, ctx);
      }
    };
    addMessageListener(gameUpdateListener);
  };


  return async (msg: any) => {
    console.log("📨 Tournament message:", msg.type);

    if (msg.type === "game_config") {
      const config = msg.payload;
      if (config && myMatch) {
        if (currentRound === "semi") {
          initGame(config, myMatch.p1, myMatch.p2);
          sendMessage("player_ready", { gameId: config.gameId, playerId: userIdStr });

          // Hide Ready Overlay
          const readyOverlay = document.getElementById("ready-overlay");
          if (readyOverlay) readyOverlay.style.display = "none";
        } else if (currentRound === "final") {
          finalGameConfig = msg.payload;
          pendingFinalGameId = finalGameConfig.gameId;
        }
      }
      return;
    }

    if (msg.type === "game_start") {
        const readyOverlay = document.getElementById("ready-overlay");
        if (readyOverlay) readyOverlay.style.display = "none";
        return;
    }

    switch (msg.type) {
      case "tournament_semi-finals": {
        currentRound = "semi";
        const s1p1 = await resolveUser(msg.payload.semi1.players[0]);
        const s1p2 = await resolveUser(msg.payload.semi1.players[1]);
        const s2p1 = await resolveUser(msg.payload.semi2.players[0]);
        const s2p2 = await resolveUser(msg.payload.semi2.players[1]);

        if (s1p1.isMe || s1p2.isMe) myMatch = { p1: s1p1, p2: s1p2 };
        else if (s2p1.isMe || s2p2.isMe) myMatch = { p1: s2p1, p2: s2p2 };

        const bracketContent = document.getElementById("big-bracket-content");
        if (bracketContent) {
            bracketContent.innerHTML = `
                <div class="flex gap-12">
                    ${createMatchCardHTML(s1p1, s1p2, "Match 1")}
                    ${createMatchCardHTML(s2p1, s2p2, "Match 2")}
                </div>
            `;
        }

        showView("view-bracket");
        await runCountdown("bracket-timer", 8);
        hideView("view-bracket");

        if (myMatch) {
            (document.getElementById("game-p1-avatar") as HTMLImageElement).src = myMatch.p1.avatar;
            document.getElementById("game-p1-name")!.textContent = myMatch.p1.name;
            (document.getElementById("game-p2-avatar") as HTMLImageElement).src = myMatch.p2.avatar;
            document.getElementById("game-p2-name")!.textContent = myMatch.p2.name;
            document.getElementById("game-round-label")!.textContent = "SEMI-FINAL";

            const readyOverlay = document.getElementById("ready-overlay");
            if(readyOverlay) {
                readyOverlay.style.display = "flex";
                readyOverlay.innerHTML = `
                   <div class="text-4xl text-white font-bold animate-pulse">Waiting for Ready...</div>
                `;
            }

            showView("view-game");
        }
        break;
      }

      case "game_finish": {
        const winner = await resolveUser(msg.payload.winner);

        hideView("view-game");

        if (currentRound === "semi") {
             const mainArea = document.getElementById("lobby-main-area");
             if (mainArea) {
                 if (winner.isMe) {
                     mainArea.innerHTML = `
                        <div class="text-center p-8">
                           <h2 class="text-4xl font-bold text-emerald-400 mb-4">VICTORY!</h2>
                           <p class="text-gray-300">You have advanced to the Finals.</p>
                           <div class="mt-6 animate-pulse text-white">Waiting for other match...</div>
                        </div>
                     `;
                 } else {
                     mainArea.innerHTML = `
                        <div class="text-center p-8">
                           <h2 class="text-4xl font-bold text-red-400 mb-4">ELIMINATED</h2>
                           <p class="text-gray-300">Better luck next time.</p>
                           <div class="mt-6 text-white">Spectating Finals...</div>
                        </div>
                     `;
                 }
             }
        }
        break;
      }

      case "tournament_final": {
        currentRound = "final";
        const f1 = await resolveUser(msg.payload.final.players[0]);
        const f2 = await resolveUser(msg.payload.final.players[1]);
        const amIPlaying = f1.isMe || f2.isMe;

        if (amIPlaying) myMatch = { p1: f1, p2: f2 };

        const bracketContent = document.getElementById("big-bracket-content");
        if (bracketContent) {
             document.querySelector("#view-bracket h1")!.textContent = "GRAND FINAL";
             bracketContent.innerHTML = createMatchCardHTML(f1, f2, "Championship Match");
        }

        showView("view-bracket");
        await runCountdown("bracket-timer", 5);
        hideView("view-bracket");

        if (amIPlaying && myMatch) {
            (document.getElementById("game-p1-avatar") as HTMLImageElement).src = myMatch.p1.avatar;
            document.getElementById("game-p1-name")!.textContent = myMatch.p1.name;
            (document.getElementById("game-p2-avatar") as HTMLImageElement).src = myMatch.p2.avatar;
            document.getElementById("game-p2-name")!.textContent = myMatch.p2.name;
            document.getElementById("game-round-label")!.textContent = "GRAND FINAL";

            const readyOverlay = document.getElementById("ready-overlay");
            if(readyOverlay) {
                readyOverlay.style.display = "flex";
                readyOverlay.innerHTML = `
                   <div class="flex flex-col items-center gap-8">
                      <h2 class="text-3xl font-bold text-white">Grand Final Ready?</h2>
                      <button id="final-ready-btn" class="btn-primary text-2xl px-12 py-6 shadow-emerald-500/30 animate-pulse">
                         I AM READY! ⚔️
                      </button>
                   </div>
                `;
                if(pendingFinalGameId) {
                    setTimeout(() => {
                        const btn = document.getElementById("final-ready-btn");
                        if(btn) {
                             btn.onclick = () => {
                                 if(finalGameConfig && myMatch) initGame(finalGameConfig, myMatch.p1, myMatch.p2);
                                 sendMessage("player_ready", { gameId: pendingFinalGameId, playerId: userIdStr });
                                 readyOverlay.style.display = "none";
                             }
                        }
                    }, 100);
                }
            }
            showView("view-game");
        }
        break;
      }

      case "tournament_finish": {
         hideView("view-game");
         const winner = await resolveUser(msg.payload.winner);
         const mainArea = document.getElementById("lobby-main-area");
         if (mainArea) {
             mainArea.innerHTML = `
                <div class="text-center p-10">
                   <div class="text-8xl mb-4">👑</div>
                   <h1 class="text-5xl font-black text-yellow-400 mb-4">CHAMPION</h1>
                   <img src="${winner.avatar}" class="w-32 h-32 rounded-full border-4 border-yellow-400 mx-auto mb-4">
                   <h2 class="text-3xl text-white font-bold">${winner.name}</h2>
                   <p class="mt-8 text-gray-500">Redirecting...</p>
                </div>
             `;
         }
         setTimeout(() => {
             cleanupTournamentMatch();
             navigateCallback("dashboard/game/tournament");
         }, 5000);
         break;
      }
      case "tournament_canceled": {
        console.log("🚫 Tournament Canceled");

        cleanupTournamentMatch();

        hideView("view-game");
        hideView("view-bracket");

        localStorage.removeItem("activeTournamentId");

        alert("Tournament canceled: A player disconnected.");
        navigateCallback("dashboard/game/tournament");
        break;
      }
    }
  };
}

export function setupTournamentGameListeners(tournamentListener: (msg: any) => void): void {
  addMessageListener(tournamentListener);
  addCleanupListener(() => {
    removeMessageListener(tournamentListener);
    cleanupTournamentMatch();
  });
}