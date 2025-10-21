import jwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

export async function verifyJWT(req: FastifyRequest, reply: FastifyReply) {
    try {
        await req.jwtVerify();
    } catch (err) {
        reply.code(401).send({ error: "Invalid or expired token" });
    }
}

