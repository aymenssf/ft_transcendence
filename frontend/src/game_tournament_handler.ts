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

const getElement = (id: string) => document.getElementById(id);

export function cleanupTournamentMatch() {
  if (keydownHandler) window.removeEventListener("keydown", keydownHandler);
  if (keyupHandler) window.removeEventListener("keyup", keyupHandler);
  if (gameUpdateListener) removeMessageListener(gameUpdateListener);
  keydownHandler = keyupHandler = gameUpdateListener = null;
  ctx = null;
}

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

// --- Input Handling ---
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

  const runCountdown = (container: HTMLElement, seconds: number): Promise<void> => {
    return new Promise((resolve) => {
      let count = seconds;
      const timerEl = container.querySelector("#countdown-timer");
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

  const createSemiFinalHTML = (semi1: { p1: any; p2: any }, semi2: { p1: any; p2: any }) => {
    const createMatchCard = (p1: any, p2: any, label: string) => `
      <div class="bg-gray-800/60 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
        <h3 class="text-center text-gray-400 text-sm mb-4 uppercase tracking-wider">${label}</h3>
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col items-center flex-1">
            <img src="${p1.avatar}" class="w-20 h-20 rounded-full border-4 ${p1.isMe ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]" : "border-gray-600"} object-cover">
            <span class="mt-2 font-semibold ${p1.isMe ? "text-emerald-400" : "text-white"}">${p1.name}${p1.isMe ? " (You)" : ""}</span>
          </div>
          <div class="text-3xl font-black text-white/30">VS</div>
          <div class="flex flex-col items-center flex-1">
            <img src="${p2.avatar}" class="w-20 h-20 rounded-full border-4 ${p2.isMe ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]" : "border-gray-600"} object-cover">
            <span class="mt-2 font-semibold ${p2.isMe ? "text-emerald-400" : "text-white"}">${p2.name}${p2.isMe ? " (You)" : ""}</span>
          </div>
        </div>
      </div>
    `;

    return `
      <div class="flex flex-col items-center justify-center min-h-full py-8">
        <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-8">SEMI-FINALS</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-4">
          ${createMatchCard(semi1.p1, semi1.p2, "Match 1")}
          ${createMatchCard(semi2.p1, semi2.p2, "Match 2")}
        </div>
        <div class="mt-8 text-gray-400 text-lg">
          Match starting in <span id="countdown-timer" class="text-emerald-400 font-bold text-2xl">8</span>s...
        </div>
      </div>
    `;
  };

  const createFinalHTML = (p1: any, p2: any) => `
    <div class="flex flex-col items-center justify-center min-h-full py-8">
      <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8">🏆 GRAND FINAL 🏆</h1>
      <div class="bg-gray-800/60 rounded-2xl p-8 border border-yellow-500/30 backdrop-blur-sm max-w-xl w-full mx-4">
        <div class="flex items-center justify-between gap-6">
          <div class="flex flex-col items-center flex-1">
            <img src="${p1.avatar}" class="w-24 h-24 rounded-full border-4 ${p1.isMe ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]" : "border-gray-600"} object-cover">
            <span class="mt-3 font-bold text-lg ${p1.isMe ? "text-emerald-400" : "text-white"}">${p1.name}${p1.isMe ? " (You)" : ""}</span>
          </div>
          <div class="text-4xl font-black text-yellow-400 animate-pulse">VS</div>
          <div class="flex flex-col items-center flex-1">
            <img src="${p2.avatar}" class="w-24 h-24 rounded-full border-4 ${p2.isMe ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]" : "border-gray-600"} object-cover">
            <span class="mt-3 font-bold text-lg ${p2.isMe ? "text-emerald-400" : "text-white"}">${p2.name}${p2.isMe ? " (You)" : ""}</span>
          </div>
        </div>
      </div>
      <div class="mt-8 text-gray-400 text-lg">
        Final match in <span id="countdown-timer" class="text-yellow-400 font-bold text-2xl">8</span>s...
      </div>
    </div>
  `;

  const createGameViewHTML = (leftPlayer: any, rightPlayer: any, showReadyButton: boolean = false) => `
    <div class="fixed inset-0 bg-gray-900 flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center p-4 z-10">
        <div class="text-white font-bold text-xl">${currentRound === "final" ? "GRAND FINAL" : "SEMI-FINAL"}</div>
        <div class="bg-gray-800/80 px-6 py-2 rounded-full border border-white/10">
          <span id="tournament-score" class="text-2xl font-mono text-emerald-400 font-bold">0 - 0</span>
        </div>
        <div class="w-24"></div>
      </div>

      <!-- Game Area -->
      <div class="flex-1 flex items-center justify-center relative">
        <!-- Left Player -->
        <div class="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <img src="${leftPlayer.avatar}" class="w-16 h-16 rounded-full border-4 ${leftPlayer.isMe ? "border-emerald-400" : "border-gray-600"} object-cover">
          <span class="mt-2 font-semibold ${leftPlayer.isMe ? "text-emerald-400" : "text-white"} text-sm bg-black/50 px-2 rounded">${leftPlayer.name}${leftPlayer.isMe ? " (You)" : ""}</span>
        </div>

        <!-- Canvas Container -->
        <div id="game-container" class="relative" style="width: 900px; height: 600px; max-width: 90vw; max-height: 70vh;"></div>

        <!-- Right Player -->
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <img src="${rightPlayer.avatar}" class="w-16 h-16 rounded-full border-4 ${rightPlayer.isMe ? "border-emerald-400" : "border-gray-600"} object-cover">
          <span class="mt-2 font-semibold ${rightPlayer.isMe ? "text-emerald-400" : "text-white"} text-sm bg-black/50 px-2 rounded">${rightPlayer.name}${rightPlayer.isMe ? " (You)" : ""}</span>
        </div>
      </div>

      <!-- Waiting Overlay -->
      <div id="waiting-overlay" class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
        <div class="flex items-center gap-12 mb-8">
          <div class="flex flex-col items-center">
            <img src="${leftPlayer.avatar}" class="w-24 h-24 rounded-full border-4 ${leftPlayer.isMe ? "border-emerald-400" : "border-gray-600"} object-cover">
            <span class="mt-2 font-bold ${leftPlayer.isMe ? "text-emerald-400" : "text-white"}">${leftPlayer.name}${leftPlayer.isMe ? " (You)" : ""}</span>
          </div>
          <div class="text-5xl font-black text-white/30">VS</div>
          <div class="flex flex-col items-center">
            <img src="${rightPlayer.avatar}" class="w-24 h-24 rounded-full border-4 ${rightPlayer.isMe ? "border-emerald-400" : "border-gray-600"} object-cover">
            <span class="mt-2 font-bold ${rightPlayer.isMe ? "text-emerald-400" : "text-white"}">${rightPlayer.name}${rightPlayer.isMe ? " (You)" : ""}</span>
          </div>
        </div>
        ${showReadyButton
          ? `<button id="final-ready-btn" class="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform shadow-lg cursor-pointer">
              🏆 READY FOR FINAL! 🏆
            </button>`
          : `<div class="text-2xl text-emerald-400 font-bold animate-pulse">⏳ Ready... Waiting for opponent...</div>`
        }
      </div>
    </div>
  `;

  const createEliminatedHTML = () => `
    <div class="flex flex-col items-center justify-center min-h-full py-8">
      <div class="text-6xl mb-6">😢</div>
      <h1 class="text-3xl font-bold text-gray-400 mb-4">You've Been Eliminated</h1>
      <p class="text-gray-500 mb-8">Waiting for tournament to finish...</p>
      <div class="animate-pulse text-gray-600">Watching final results...</div>
    </div>
  `;

  const createWinnerHTML = (winner: any) => `
    <div class="flex flex-col items-center justify-center min-h-full py-8">
      <div class="text-8xl mb-6 animate-bounce">👑</div>
      <img src="${winner.avatar}" class="w-40 h-40 rounded-full border-4 border-yellow-400 shadow-[0_0_50px_rgba(234,179,8,0.6)] object-cover mb-6">
      <h1 class="text-4xl font-black ${winner.isMe ? "text-emerald-400" : "text-yellow-400"} mb-2">
        ${winner.name}${winner.isMe ? " (You)" : ""}
      </h1>
      <p class="text-2xl text-gray-400">${winner.isMe ? "🎉 You are the Champion! 🎉" : "Tournament Champion"}</p>
      <p class="mt-8 text-gray-500">Returning to lobby in 5 seconds...</p>
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
    console.log("📨 Tournament message received:", msg.type);

    const container = getElement("lobby-container");
    if (!container) {
      console.error("❌ lobby-container not found!");
      return;
    }

    if (msg.type === "game_config") {
      console.log("🎮 Game config received!");
      const config = msg.payload;
      if (config && myMatch) {
        if (currentRound === "semi") {
          initGame(config, myMatch.p1, myMatch.p2);

          console.log("📤 Sending player_ready:", { gameId: config.gameId, playerId: userIdStr });
          sendMessage("player_ready", { gameId: config.gameId, playerId: userIdStr });

          const waitingOverlay = document.getElementById("waiting-overlay");
          if (waitingOverlay) {
            waitingOverlay.style.display = "none";
            console.log("✅ Semi-final game started!");
          }
        }
        else if (currentRound === "final") {
          finalGameConfig = msg.payload;
          pendingFinalGameId = finalGameConfig.gameId;
          console.log("🏆 Final game config stored for later. GameId:", config.gameId);
        }
      }
      return;
    }

    if (msg.type === "game_start") {
      console.log("🚀 Game started!");
      const waitingOverlay = document.getElementById("waiting-overlay");
      if (waitingOverlay) waitingOverlay.style.display = "none";
      return;
    }

    switch (msg.type) {
      case "tournament_semi-finals": {
        console.log("🏆 SEMI-FINALS received!");
        currentRound = "semi";
        const s1p1 = await resolveUser(msg.payload.semi1.players[0]);
        const s1p2 = await resolveUser(msg.payload.semi1.players[1]);
        const s2p1 = await resolveUser(msg.payload.semi2.players[0]);
        const s2p2 = await resolveUser(msg.payload.semi2.players[1]);

        if (s1p1.isMe || s1p2.isMe) {
          myMatch = { p1: s1p1, p2: s1p2 };
        } else if (s2p1.isMe || s2p2.isMe) {
          myMatch = { p1: s2p1, p2: s2p2 };
        }
        console.log("👤 My match:", myMatch);

        container.innerHTML = createSemiFinalHTML({ p1: s1p1, p2: s1p2 }, { p1: s2p1, p2: s2p2 });

        await runCountdown(container, 8);

        if (myMatch) {
          container.innerHTML = createGameViewHTML(myMatch.p1, myMatch.p2);
          console.log("📺 Game view shown. Waiting for game_config...");
        }
        break;
      }

      case "game_finish": {
        cleanupTournamentMatch();
        const winnerId = msg.payload.winner;

        if (myMatch && String(winnerId) !== userIdStr) {
          const iWasInMatch = myMatch.p1.isMe || myMatch.p2.isMe;
          if (iWasInMatch) {
            isEliminated = true;
            container.innerHTML = createEliminatedHTML();
          }
        }
        break;
      }

      case "tournament_final": {
        currentRound = "final";
        const f1 = await resolveUser(msg.payload.final.players[0]);
        const f2 = await resolveUser(msg.payload.final.players[1]);

        const amIPlaying = f1.isMe || f2.isMe;

        if (amIPlaying) {
          myMatch = { p1: f1, p2: f2 };
          isEliminated = false;

          container.innerHTML = createFinalHTML(f1, f2);

          await runCountdown(container, 8);

          container.innerHTML = createGameViewHTML(f1, f2, true);
          console.log("📺 Final game view rendered with button.");

          if (pendingFinalGameId) {
            console.log("🎮 Setting up final ready button with stored gameId:", pendingFinalGameId);

            setTimeout(() => {
              const readyBtn = document.getElementById("final-ready-btn") as HTMLButtonElement;
              if (readyBtn) {
                console.log("✅ Final button found!");

                readyBtn.onclick = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🚀 FINAL READY BUTTON CLICKED!");

                  const configToUse = { gameId: pendingFinalGameId, ...gameConfig };
                  if (finalGameConfig && myMatch) {
                    initGame(finalGameConfig, myMatch.p1, myMatch.p2);
                  }
                  console.log("📤 Sending player_ready:", { gameId: pendingFinalGameId, playerId: userIdStr });
                  sendMessage("player_ready", { gameId: pendingFinalGameId, playerId: userIdStr });

                  const waitingOverlay = document.getElementById("waiting-overlay");
                  if (waitingOverlay) waitingOverlay.style.display = "none";

                  return false;
                };

                readyBtn.onmouseenter = () => console.log("🖱️ Mouse on button");
                console.log("✅ Button handler attached!");
              } else {
                console.error("❌ Button not found!");
              }
            }, 100);
          } else {
            console.warn("⚠️ No pendingFinalGameId yet, button will be setup when game_config arrives");
          }
        } else {
          isEliminated = true;
          container.innerHTML = createEliminatedHTML();

          // container.innerHTML = `
          //   <div class="flex flex-col items-center justify-center min-h-full py-8">
          //     <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8">🏆 GRAND FINAL 🏆</h1>
          //     <div class="bg-gray-800/60 rounded-2xl p-8 border border-yellow-500/30 backdrop-blur-sm max-w-xl w-full mx-4">
          //       <div class="flex items-center justify-between gap-6">
          //         <div class="flex flex-col items-center flex-1">
          //           <img src="${f1.avatar}" class="w-24 h-24 rounded-full border-4 border-gray-600 object-cover">
          //           <span class="mt-3 font-bold text-lg text-white">${f1.name}</span>
          //         </div>
          //         <div class="text-4xl font-black text-yellow-400 animate-pulse">VS</div>
          //         <div class="flex flex-col items-center flex-1">
          //           <img src="${f2.avatar}" class="w-24 h-24 rounded-full border-4 border-gray-600 object-cover">
          //           <span class="mt-3 font-bold text-lg text-white">${f2.name}</span>
          //         </div>
          //       </div>
          //     </div>
          //     <div class="mt-8 text-gray-500">You were eliminated. Watching the final...</div>
          //   </div>
          // `;
          localStorage.removeItem("activeTournamentId");
          navigateCallback("dashboard/game/tournament");
        }
        break;
      }

      case "tournament_finish": {
        cleanupTournamentMatch();
        const winner = await resolveUser(msg.payload.winner);

        if (winner.id === userId.toString()){
          container.innerHTML = createWinnerHTML(winner);

        setTimeout(() => {
          localStorage.removeItem("activeTournamentId");
          navigateCallback("dashboard/game/tournament");
        }, 5000);
        }  else {
          localStorage.removeItem("activeTournamentId");
          navigateCallback("dashboard/game/tournament");
        }
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