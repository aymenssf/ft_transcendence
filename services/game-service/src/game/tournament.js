import { tournaments, games } from "../utils/store.js"

function startTournament(tournamentId) {
    const tournament = tournaments.get(tournamentId);
    if (!tournament || tournament.players.length !== 4) return;

    const [p1, p2, p3, p4] = tournament.players;

    const semi1 = createGameRoom({ p1, p2, mode: "tournament" });
    const semi2 = createGameRoom({ p1: p3, p2: p4, mode: "tournament" });

    tournament.rounds.push(semi1, semi2);
    tournament.status = "semifinals";

    games.set(semi1.gameId, semi1);
    games.set(semi2.gameId, semi2);
}


function reportGameResult(gameId, winnerId) {
    const game = games.get(gameId);
    if (!game) return;

    const tournament = [...tournaments.values()].find(t =>
        t.rounds.some(r => r.gameId === gameId)
    );
    if (!tournament) return;

    game.status = "finished";

    if (tournament.status === "semifinals") {
        tournament.winners = (tournament.winners || []).concat(winnerId);

        if (tournament.winners.length === 2) {
            const [w1, w2] = tournament.winners;
            const final = createGameRoom({ p1: w1, p2: w2, mode: "tournament" });
            tournament.rounds.push(final);
            tournament.status = "final";
            games.set(final.gameId, final);
        }
    } else if (tournament.status === "final") {
        tournament.winner = winnerId;
        tournament.status = "finished";
    }
}

function createTournament(playerIds) {
    const tournamentId = crypto.randomUUID();
    const tournament = {
        tournamentId,
        status: "waiting",
        players: playerIds,
        rounds: [],
        winner: null,
    };

    tournaments.set(tournamentId, tournament);

    if (playerIds.length === 4) {
        startTournament(tournamentId);
    }

    return tournament;
}
