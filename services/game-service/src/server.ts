import Fastify, {FastifyInstance, FastifyRequest, FastifyReply} from "fastify";
import websocket from "@fastify/websocket";
import gameSocket from "./game/gameSocket.js";
import friendRoutes from "./game/friendGame.js";

const app: FastifyInstance = Fastify({ logger: true });
await app.register(websocket);
await app.register(friendRoutes);
await app.register(gameSocket);


app.get('/', async (req: FastifyRequest, reply:FastifyReply) => {
    return 'Hello From the Game Server :_:';
});


app.listen({ port: 3012, host: '0.0.0.0' }, (err: any, addr: any) => {
    console.log(`**************** Server listenning on ${addr} *****************`);
});
