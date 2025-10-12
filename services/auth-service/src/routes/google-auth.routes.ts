import fastify, { FastifyInstance } from "fastify";
import { getGoogleAuthUrl, getGoogleUserFromCode } from '../services/google-auth.service.js';
import { findOrCreateGoogleUser } from '../services/user.service.js'


export async function GoogleAuthRoutes(fastify: FastifyInstance)
{
    fastify.get('/auth/google', async (request, reply) => {
        try 
        {
            const authUrl = getGoogleAuthUrl();
         reply.redirect(authUrl);

        }
        catch (error) 
        {
        reply.status(500).send({
        error: 'Failed to initiate Google authentication'
      });
    }
  });
  fastify.get('/auth/google/callback', async (request, reply) => {
    try {
      const { code, error } = request.query as { code?: string; error?: string };
      
      if (error) {
        return reply.redirect(
          `${process.env.FRONTEND_URL}?error=access_denied`
        );
      }
      
      if (!code) {
        return reply.redirect(
          `${process.env.FRONTEND_URL}?error=no_code`
        );
      }
      
      const googleUser = await getGoogleUserFromCode(code);
      
      const user = await findOrCreateGoogleUser({
        googleId: googleUser.googleId,
        email: googleUser.email!,
        name: googleUser.name!,
        avatar: googleUser.avatar
      });
      
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username,
        provider: user.provider,
        avatar: user.avatar
      });
      
      reply.redirect(
        `${process.env.FRONTEND_URL}?token=${token}`
      );
      
    } catch (error) {
      console.error('Google auth callback error:', error);
      reply.redirect(
        `${process.env.FRONTEND_URL}?error=auth_failed`
      );
    }
  });
}

