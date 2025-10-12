import Fastify from "fastify";
import websocket from "@fastify/websocket";
import jwt from "@fastify/jwt";
import gameSocket from "./src/game/gameSocket.js";
import friendRoutes from "./src/game/friendGame.js";


const app = Fastify({ logger: true });
await app.register(jwt, {
  secret: process.env.JWT_SECRET,
});
await app.register(websocket);
await app.register(friendRoutes);
await app.register(gameSocket);
app.get('/', async (req, res) => {
    return 'Hello From the Game Server :_:';
});


app.listen({ port: 3012, host: '0.0.0.0' }, (err, addr) => {
    console.log(`**************** Server listenning on ${addr} *****************`);
});
