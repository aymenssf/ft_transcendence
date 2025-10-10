import { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticateJWT(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify() as any;
    // Add user info to request
    (request as any).user = {
      id: decoded.userId,
      username: decoded.username
    };
  } catch (err) {
    reply.send(err);
  }
}
