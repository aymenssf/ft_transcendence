// Collections for game logic
export const waitingQueue = new Set();;
export const games = new Map();        // Map<string, GameRoom>
export const tournaments = new Map(); // Map<string, Tournament>


// for conected players
export const playersSockets = new Map();