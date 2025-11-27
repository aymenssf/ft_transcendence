// @ts-ignore
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import websocket from "@fastify/websocket";
import gameSocket from "./game/gameSocket.js";
import friendRoutes from "./game/friendGame.js";
import { tournamentRoute } from "./game/tournament.js";
// @ts-ignore
import cors from '@fastify/cors';
// @ts-ignore
import jwt from '@fastify/jwt';
import { gameAPIs } from "./game/gameAPIs.js"
import fs from 'fs'
import { gameModelRoutes } from "./route/gameModelRoutes.js";


const app: FastifyInstance = Fastify({
    logger: true,
    // https: {
    //     key: fs.readFileSync('/keys/key.pem'),
    //     cert: fs.readFileSync('/keys/cert.pem'),
    // },
});

await app.register(jwt, {
    secret: process.env.JWT_SECRET as string
});

await app.register(cors, { origin: '*' });
await app.register(websocket);
await app.register(friendRoutes);
await app.register(gameSocket);
await app.register(tournamentRoute);
await app.register(gameAPIs);
await app.register(gameModelRoutes);


app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    return 'Hello From the Game Server :_:';
});


app.listen({ port: 3012, host: '0.0.0.0' }, (err: any, addr: any) => {
});
