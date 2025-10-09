// /**
//  * @typedef {Object} Room
//  * @property {string} code
//  * @property {string} host  // playerId
//  * @property {string} [guest]  // optional playerId
//  * @property {"waiting"|"full"} status
//  */


/**
 * @typedef {Object} GameRoom
 * @property {string} gameId
 * @property {string} p1
 * @property {string|null} p2
 * @property {"waiting"|"ongoing"|"finished"} status
 * @property {"local"|"friend"|"random"|"ai_opponent"|"tournament"} mode
 * @property {"easy"|"medium"|"hard"} difficulty
 * @property {Set<string>} sockets
 * @property {NodeJS.Timer|null} loop
 * @property {Object} state
 * @property {Object} state.canvas
 * @property {Object} state.paddles
 * @property {Object} state.ball
 * @property {string} winner
 */

/**
 * @typedef {Object} Tournament
 * @property {string} tournamentId
 * @property {string} title
 * @property {"waiting"|"semifinals"|"final"|"finished"} status
 * @property {string[]} players
 * @property {GameRoom[]} rounds   // list of game rooms (semis + final)
 * @property {string|null} winner
 */


// exporting nothing, typedefs are just for editor support
export { };
