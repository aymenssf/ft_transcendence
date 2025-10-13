import { FastifyInstance } from 'fastify';
import { Socket } from 'socket.io';
import { onlineUsers } from './handler.js';

export function registerSocketEvents(app: FastifyInstance, socket: Socket) {
  const userId = socket.user?.id;

  // Join a chat room
  socket.on('join-room', async (data: { chatRoomId: number }) => {
    const roomId = data.chatRoomId.toString();
    socket.join(roomId);
    app.log.info(`User ${userId} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined-room', { userId, roomId });
  });

  // Leave a chat room
  socket.on('leave-room', async (data: { chatRoomId: number }) => {
    const roomId = data.chatRoomId.toString();
    socket.leave(roomId);
    app.log.info(`User ${userId} left room ${roomId}`);
    socket.to(roomId).emit('user-left-room', { userId, roomId });
  });

  // Send message to room
  socket.on('send-message', async (data: { chatRoomId: number; content: string }) => {
    try {
      const { chatRoomId, content } = data;

      if (!content || !chatRoomId || !userId) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Save message to database
      const message = await app.db.createMessage(content, userId, chatRoomId);

      // Get room members to check blocking
      const { prisma } = await import('@ft/shared-database');

      const members = await prisma.chatRoomMember.findMany({
        where: { chatRoomId },
        select: { userId: true }
      });

      // Broadcast message to room members except blocked users
      for (const member of members) {
        if (member.userId === userId) continue; // Skip sender

        // Check if this member has blocked the sender
        const isBlocked = await app.db.isUserBlocked(member.userId, userId);

        if (!isBlocked) {
          const memberSocketId = onlineUsers.get(member.userId);
          if (memberSocketId) {
            app.io.to(memberSocketId).emit('message', {
              id: message.id,
              chatRoomId: message.chatRoomId,
              content: message.content,
              type: message.type,
              senderId: message.senderId,
              sender: message.sender,
              created_at: message.created_at
            });
          }
        }
      }

      // Send confirmation to sender
      socket.emit('message', {
        id: message.id,
        chatRoomId: message.chatRoomId,
        content: message.content,
        type: message.type,
        senderId: message.senderId,
        sender: message.sender,
        created_at: message.created_at
      });

    } catch (error: any) {
      app.log.error('Error sending message:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Send direct message
  socket.on('send-direct-message', async (data: { receiverId: number; content: string }) => {
    try {
      const { receiverId, content } = data;

      if (!receiverId || !content || !userId) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Check if sender is blocked
      const isBlocked = await app.db.isUserBlocked(receiverId, userId);
      if (isBlocked) {
        socket.emit('error', { message: 'Cannot send message to this user' });
        return;
      }

      // Find or create private chat room
      const { prisma } = await import('@ft/shared-database');

      let chatRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'private',
          AND: [
            { members: { some: { userId: userId } } },
            { members: { some: { userId: receiverId } } }
          ]
        }
      });

      if (!chatRoom) {
        chatRoom = await prisma.chatRoom.create({
          data: {
            type: 'private',
            ownerId: userId,
            members: {
              create: [
                { userId: userId, role: 'owner' },
                { userId: receiverId, role: 'member' }
              ]
            }
          }
        });
      }

      // Save message
      const message = await app.db.createMessage(content, userId, chatRoom.id);

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        app.io.to(receiverSocketId).emit('direct-message', {
          id: message.id,
          chatRoomId: message.chatRoomId,
          content: message.content,
          senderId: message.senderId,
          sender: message.sender,
          created_at: message.created_at
        });
      }

      // Confirm to sender
      socket.emit('direct-message', {
        id: message.id,
        chatRoomId: message.chatRoomId,
        content: message.content,
        senderId: message.senderId,
        sender: message.sender,
        created_at: message.created_at
      });

    } catch (error: any) {
      app.log.error('Error sending direct message:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Send game invitation
  socket.on('send-game-invite', async (data: { receiverId: number; chatRoomId?: number }) => {
    try {
      const { receiverId, chatRoomId } = data;

      if (!receiverId || !userId) {
        socket.emit('error', { message: 'Invalid invitation data' });
        return;
      }

      // Check if receiver is blocked
      const isBlocked = await app.db.isUserBlocked(receiverId, userId);
      if (isBlocked) {
        socket.emit('error', { message: 'Cannot invite this user' });
        return;
      }

      // Create game invitation
      const invitation = await app.db.createGameInvitation(userId, receiverId, chatRoomId);

      // Get sender info
      const sender = await app.db.findUserById(userId);

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        app.io.to(receiverSocketId).emit('game-invitation', {
          id: invitation.id,
          senderId: userId,
          senderUsername: sender.username,
          chatRoomId: invitation.chatRoomId,
          created_at: invitation.created_at
        });
      }

      // If there's a chat room, save as message
      if (chatRoomId) {
        const messageContent = JSON.stringify({
          invitationId: invitation.id,
          receiverId,
          receiverUsername: (await app.db.findUserById(receiverId)).username
        });

        await app.db.createMessage(
          messageContent,
          userId,
          chatRoomId,
          'game_invitation',
          JSON.stringify({ invitationId: invitation.id })
        );
      }

      socket.emit('game-invite-sent', { invitationId: invitation.id });

    } catch (error: any) {
      app.log.error('Error sending game invitation:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Respond to game invitation
  socket.on('game-invite-response', async (data: { invitationId: number; accepted: boolean }) => {
    try {
      const { invitationId, accepted } = data;

      const invitation = await app.db.getGameInvitationById(invitationId);
      if (!invitation) {
        socket.emit('error', { message: 'Invitation not found' });
        return;
      }

      if (invitation.receiverId !== userId) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      // Update invitation status
      const status = accepted ? 'accepted' : 'declined';
      await app.db.updateGameInvitationStatus(invitationId, status);

      // Notify sender
      const senderSocketId = onlineUsers.get(invitation.senderId);
      if (senderSocketId) {
        app.io.to(senderSocketId).emit('game-invite-response', {
          invitationId,
          accepted,
          responderId: userId
        });
      }

      socket.emit('game-invite-response-sent', { invitationId, accepted });

    } catch (error: any) {
      app.log.error('Error responding to game invitation:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (data: { roomId: number }) => {
    const roomId = data.roomId.toString();
    socket.to(roomId).emit('user-typing', { userId, roomId });
  });

  // Stop typing indicator
  socket.on('stop-typing', (data: { roomId: number }) => {
    const roomId = data.roomId.toString();
    socket.to(roomId).emit('user-stop-typing', { userId, roomId });
  });
}
