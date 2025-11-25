import { FastifyInstance } from 'fastify';
import { onlineUsers } from '../socket/handler.js';

interface GameInviteBody {
  targetUserId: number;
  chatRoomId?: number;
}

interface GameInviteResponseBody {
  invitationId: number;
  accepted: boolean;
}

export async function gameRoutes(app: FastifyInstance) {
  app.post('/api/game/invite', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { targetUserId, chatRoomId } = request.body as GameInviteBody;
      const userId = request.user.id;

      if (!targetUserId) {
        return reply.status(400).send({ message: 'Target user ID is required' });
      }

      if (userId === targetUserId) {
        return reply.status(400).send({ message: 'Cannot invite yourself' });
      }

      const targetUser = await app.db.findUserById(targetUserId);
      if (!targetUser) {
        return reply.status(404).send({ message: 'Target user not found' });
      }

      const isBlocked = await app.db.isUserBlocked(targetUserId, userId);
      if (isBlocked) {
        return reply.status(403).send({ message: 'Cannot invite this user' });
      }

      const invitation = await app.db.createGameInvitation(userId, targetUserId, chatRoomId);

      const sender = await app.db.findUserById(userId);

      const targetSocketId = onlineUsers.get(targetUserId);
      
      // Debug logging
      app.log.info(`🎮 Game invitation: sender=${userId}, target=${targetUserId}`);
      app.log.info(`🎮 Online users: ${JSON.stringify(Array.from(onlineUsers.entries()))}`);
      app.log.info(`🎮 Target socket ID: ${targetSocketId}`);
      
      if (targetSocketId) {
        app.log.info(`🎮 Emitting game-invitation to socket ${targetSocketId}`);
        const invitationData = {
          id: invitation.id,
          senderId: userId,
          senderUsername: sender?.username || 'Unknown',
          senderAvatar: sender?.avatar,
          chatRoomId: invitation.chatRoomId,
          created_at: invitation.created_at
        };
        app.log.info(`🎮 Invitation data: ${JSON.stringify(invitationData)}`);
        
        // Try multiple methods to ensure delivery
        const targetSocket = app.io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          app.log.info(`🎮 Socket instance found, emitting directly`);
          targetSocket.emit('game-invitation', invitationData);
          app.log.info(`🎮 Direct emit completed`);
        } else {
          app.log.warn(`🎮 Socket instance not found for ID: ${targetSocketId}`);
        }
        
        // Also try room-based emit as backup
        app.io.to(targetSocketId).emit('game-invitation', invitationData);
        app.log.info(`🎮 Room-based emit completed`);
        
      } else {
        app.log.warn(`🎮 Target user ${targetUserId} not online, socket ID not found`);
      }

      if (chatRoomId) {
        const messageContent = `Game invitation to ${targetUser.username}`;
        const metadata = JSON.stringify({
          invitationId: invitation.id,
          targetUserId,
          targetUsername: targetUser.username
        });

        const message = await app.db.createMessage(
          messageContent,
          userId,
          chatRoomId,
          'game_invitation',
          metadata
        );

        app.io.to(chatRoomId.toString()).emit('message', {
          id: message.id,
          chatRoomId,
          content: messageContent,
          type: 'game_invitation',
          metadata,
          senderId: userId,
          sender: { 
            id: userId, 
            username: sender.username,
            avatar: sender.avatar 
          },
          senderName: sender.username,
          senderAvatar: sender.avatar,
          timestamp: message.created_at,
          created_at: message.created_at
        });
      }

      return {
        message: 'Game invitation sent successfully',
        invitation: {
          id: invitation.id,
          receiverId: targetUserId,
          chatRoomId: invitation.chatRoomId,
          status: invitation.status
        }
      };
    } catch (error: any) {
      app.log.error('Error sending game invitation:', error);
      reply.status(500).send({
        message: 'Failed to send game invitation',
        error: error.message
      });
    }
  });

  app.post('/api/game/accept', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { invitationId } = request.body as { invitationId: number };
      const userId = request.user.id;

      if (!invitationId) {
        return reply.status(400).send({ message: 'Invitation ID is required' });
      }

      const invitation = await app.db.getGameInvitationById(invitationId);
      if (!invitation) {
        return reply.status(404).send({ message: 'Invitation not found' });
      }

      if (invitation.receiverId !== userId) {
        return reply.status(403).send({ message: 'Not authorized to accept this invitation' });
      }

      if (invitation.status !== 'pending') {
        return reply.status(400).send({ message: `Invitation already ${invitation.status}` });
      }

      const gameRoomId = `game_${invitation.senderId}_${userId}_${Date.now()}`;

      await app.db.updateGameInvitationStatus(invitationId, 'accepted', gameRoomId);

      const senderSocketId = onlineUsers.get(invitation.senderId);
      if (senderSocketId) {
        app.io.to(senderSocketId).emit('game-invite-accepted', {
          invitationId,
          gameRoomId,
          acceptedBy: userId
        });
      }

      return {
        message: 'Game invitation accepted',
        gameRoomId,
        invitationId
      };
    } catch (error: any) {
      app.log.error('Error accepting game invitation:', error);
      reply.status(500).send({
        message: 'Failed to accept game invitation',
        error: error.message
      });
    }
  });

  app.post('/api/game/decline', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { invitationId } = request.body as { invitationId: number };
      const userId = request.user.id;

      if (!invitationId) {
        return reply.status(400).send({ message: 'Invitation ID is required' });
      }

      const invitation = await app.db.getGameInvitationById(invitationId);
      if (!invitation) {
        return reply.status(404).send({ message: 'Invitation not found' });
      }

      if (invitation.receiverId !== userId) {
        return reply.status(403).send({ message: 'Not authorized to decline this invitation' });
      }

      if (invitation.status !== 'pending') {
        return reply.status(400).send({ message: `Invitation already ${invitation.status}` });
      }

      await app.db.updateGameInvitationStatus(invitationId, 'declined');

      const senderSocketId = onlineUsers.get(invitation.senderId);
      if (senderSocketId) {
        app.io.to(senderSocketId).emit('game-invite-declined', {
          invitationId,
          declinedBy: userId
        });
      }

      return {
        message: 'Game invitation declined',
        invitationId
      };
    } catch (error: any) {
      app.log.error('Error declining game invitation:', error);
      reply.status(500).send({
        message: 'Failed to decline game invitation',
        error: error.message
      });
    }
  });

  app.get('/api/game/invitations', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const { status } = request.query as { status?: string };

      const invitations = await app.db.getUserGameInvitations(userId, status);

      return {
        invitations
      };
    } catch (error: any) {
      app.log.error('Error fetching game invitations:', error);
      reply.status(500).send({
        message: 'Failed to fetch game invitations',
        error: error.message
      });
    }
  });
}
