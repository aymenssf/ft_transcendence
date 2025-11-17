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
  // Send game invitation
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

      // Check if target user exists
      const targetUser = await app.db.findUserById(targetUserId);
      if (!targetUser) {
        return reply.status(404).send({ message: 'Target user not found' });
      }

      // Check if sender is blocked
      const isBlocked = await app.db.isUserBlocked(targetUserId, userId);
      if (isBlocked) {
        return reply.status(403).send({ message: 'Cannot invite this user' });
      }

      // Create game invitation
      const invitation = await app.db.createGameInvitation(userId, targetUserId, chatRoomId);

      // Get sender info
      const sender = await app.db.findUserById(userId);

      // Send real-time notification via socket if user is online
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        app.io.to(targetSocketId).emit('game-invitation', {
          id: invitation.id,
          senderId: userId,
          senderUsername: sender.username,
          chatRoomId: invitation.chatRoomId,
          created_at: invitation.created_at
        });
      }

      // If there's a chat room, save as a message
      if (chatRoomId) {
        const messageContent = `Game invitation to ${targetUser.username}`;
        const metadata = JSON.stringify({
          invitationId: invitation.id,
          targetUserId,
          targetUsername: targetUser.username
        });

        await app.db.createMessage(
          messageContent,
          userId,
          chatRoomId,
          'game_invitation',
          metadata
        );

        // Broadcast to room
        app.io.to(chatRoomId.toString()).emit('message', {
          id: invitation.id,
          chatRoomId,
          content: messageContent,
          type: 'game_invitation',
          metadata,
          senderId: userId,
          sender: { id: userId, username: sender.username },
          created_at: invitation.created_at
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

  // Accept game invitation
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

      // Generate game room ID
      const gameRoomId = `game_${invitation.senderId}_${userId}_${Date.now()}`;

      // Update invitation
      await app.db.updateGameInvitationStatus(invitationId, 'accepted', gameRoomId);

      // Notify sender via socket
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

  // Decline game invitation
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

      // Update invitation
      await app.db.updateGameInvitationStatus(invitationId, 'declined');

      // Notify sender via socket
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

  // Get user's game invitations
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
