// src/routes/gameRoutes.ts
import { FastifyInstance } from 'fastify'
import { GameModel } from '../model/gameModels.js'
import { verifyJWT } from '../middleware/verifyJWT.js'

export async function gameModelRoutes(fastify: FastifyInstance) {
    fastify.get('/matches', async () => {
        return await GameModel.getAllMatches()
    })

    fastify.get('/matches/:id', async (req, reply) => {
        const { id } = req.params as { id: string };

        const matchId = Number(id);

        if (isNaN(matchId)) {
            return reply.status(400).send({ error: "Invalid match ID" });
        }

        return await GameModel.getMatchById(matchId);
    });


    fastify.get('/matches/user/:id', async (req) => {
        const { id } = req.params as { id: string };

        return await GameModel.getUserMatches(id);
    });

    fastify.get('/matches/user/:id/stats', async (req) => {
        const { id } = req.params as { id: string };
        return await GameModel.getUserStats(id);
    });



}
