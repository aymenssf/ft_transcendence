import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auth42Service } from '../services/42-auth.service.js';
import { userService } from '../services/user.service.js';

export async function Auth42Routes(fastify: FastifyInstance) {
  fastify.get('/auth/42', async (request: FastifyRequest, reply: FastifyReply) => {
    try 
    {
      const query = request.query as { redirect_url?: string };
      const redirectUrl = query.redirect_url;
      
      const { url, state } = auth42Service.generateAuthUrl({ 
        redirectUrl,
        timestamp: Date.now()
      });

      fastify.log.info(`42 OAuth login initiated - State: ${state.substring(0, 8)}...`);
      return reply.redirect(url);
    } 
    catch (error) {
      fastify.log.error('Error initiating 42 OAuth: ' + String(error));
      return reply.status(500).send({
        error: 'OAuth Error',
        message: 'Failed to initiate 42 authentication'
      });
    }
  });

  fastify.get('/auth/42/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try 
    {
      const query = request.query as { 
        code?: string; 
        state?: string; 
        error?: string; 
        error_description?: string; 
      };
      const { code, state, error, error_description } = query;

      if (error) 
      {
        fastify.log.warn(`42 OAuth error: ${error} - ${error_description || ''}`);
        return reply.status(400).send({
          error: 'OAuth Error',
          message: error_description || 'Authentication failed',
          details: error
        });
      }

      if (!code || !state) 
      {
        fastify.log.warn(`Missing OAuth parameters - code: ${!!code}, state: ${!!state}`);
        return reply.status(400).send({
          error: 'Invalid Request',
          message: 'Missing authorization code or state parameter'
        });
      }

      const stateValidation = auth42Service.validateState(state);
      if (!stateValidation.valid) 
      {
        fastify.log.warn(`Invalid state parameter: ${state.substring(0, 8)}...`);
        return reply.status(400).send({
          error: 'Security Error',
          message: 'Invalid or expired state parameter'
        });
      }

      fastify.log.info(`Processing 42 OAuth callback - State: ${state.substring(0, 8)}...`);

      const tokenResponse = await auth42Service.exchangeCodeForToken(code);
      const profile = await auth42Service.getUserProfile(tokenResponse.access_token);
      
      fastify.log.info(`42 profile retrieved - Login: ${profile.login}, Email: ${profile.email}`);

      const user = await userService.createOrUpdateFrom42Profile(profile);
      
      const jwtToken = fastify.jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          email: user.email,
          provider: '42',
          is_42_user: true,
          usernameTournament: (user as any).usernameTournament ?? null
        },
        { 
          expiresIn: '7d'
        }
      );

      fastify.log.info(`User authenticated - ID: ${user.id}, Username: ${user.username}`);

      const redirectUrl = stateValidation.data?.redirectUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

      const authData = {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          usernameTournament: (user as any).usernameTournament ?? null,
          is_42_user: user.is_42_user,
          provider: user.provider
        },
        token: jwtToken,
        expiresIn: 7 * 24 * 60 * 60
      };

      const frontendUrl = process.env.FRONTEND_URL || 'https://localhost';
      const targetPath = stateValidation.data?.redirectUrl || '/dashboard';
      const fullRedirectUrl = `${frontendUrl}${targetPath}`;
      
      const urlParams = new URLSearchParams({
        token: jwtToken,
        user: JSON.stringify(authData.user)
      });
      
      return reply.redirect(`${fullRedirectUrl}?${urlParams.toString()}`);

    } 
    catch (error) {
      fastify.log.error('Error in 42 OAuth callback: ' + String(error));
      
      let statusCode = 500;
      let errorMessage = 'Authentication failed';
      
      if (error instanceof Error) 
      {
        if (error.message.includes('42 API Error')) 
        {
          statusCode = 502;
          errorMessage = 'Failed to communicate with 42 API';
        } 
        else if (error.message.includes('Invalid or expired')) 
        {
          statusCode = 401;
          errorMessage = error.message;
        } 
        else if (error.message.includes('already exists')) 
        {
          statusCode = 409;
          errorMessage = 'User account conflict';
        }
      }

      return reply.status(statusCode).send({
        error: 'Authentication Failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });

  fastify.get('/auth/42/status', {
    preHandler: async (request: any, reply: FastifyReply) => {
      try 
      {
        await request.jwtVerify();
      } 
      catch (err) {
        return reply.send({ authenticated: false, error: 'Invalid token' });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try 
    {
      const user = await userService.findById(request.user.userId);
      
      if (!user) 
      {
        return reply.status(404).send({
          authenticated: false,
          error: 'User not found'
        });
      }

      return reply.send({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          usernameTournament: (user as any).usernameTournament ?? null,
          is_42_user: user.is_42_user,
          provider: user.provider,
          status: user.status,
          lastSeen: user.lastSeen
        }
      });
    } 
    catch (error) {
      fastify.log.error('Error checking auth status: ' + String(error));
      return reply.status(500).send({
        authenticated: false,
        error: 'Failed to check authentication status'
      });
    }
  });

  fastify.post('/auth/42/logout', {
    preHandler: async (request: any, reply: FastifyReply) => {
      try 
      {
        await request.jwtVerify();
      } 
      catch (err) {
        return reply.send({ success: false, error: 'Invalid token' });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try 
    {
      await userService.updateUserStatus(request.user.userId, 'offline');
      fastify.log.info(`User logged out - ID: ${request.user.userId}`);

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    } 
    catch (error) {
      fastify.log.error('Error during logout: ' + String(error));
      return reply.status(500).send({
        success: false,
        error: 'Logout failed'
      });
    }
  });

  fastify.get('/auth/42/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try 
    {
      const hasConfig = !!(process.env['FORTYTWO_UID'] && process.env['FORTYTWO_SECRET']);
      const stateStats = auth42Service.getStateStats();
      
      return reply.send({
        status: 'healthy',
        service: '42-oauth',
        config: hasConfig ? 'valid' : 'missing',
        redirectUri: auth42Service.getRedirectUri(),
        stateStore: stateStats,
        timestamp: new Date().toISOString()
      });
    } 
    catch (error) {
      fastify.log.error('Health check failed: ' + String(error));
      return reply.status(503).send({
        status: 'unhealthy',
        service: '42-oauth',
        error: 'Service unavailable'
      });
    }
  });
}

export { Auth42Routes as GoogleAuthRoutes };
