// src/routes/gameRoutes.ts
import { FastifyInstance } from 'fastify'
import { GameModel } from '../model/gameModels.js'
import { verifyJWT } from '../middleware/verifyJWT.js'

export async function gameModelRoutes(fastify: FastifyInstance) {
    fastify.get('/matches', async () => {
        return await GameModel.getAllMatches()
    })

    fastify.get('/matches/:id', async (req) => {
        const { id } = req.params as { id: string }
        return await GameModel.getMatchById(id)
    })

    fastify.get('/matches/user/:id', async (req) => {
        const { id } = req.params as { id: string };

        return await GameModel.getUserMatches(id);
    });

    fastify.get('/matches/user/:id/stats', async (req) => {
        const { id } = req.params as { id: string };
        return await GameModel.getUserStats(id);
    });



}
