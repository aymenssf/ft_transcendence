import { FastifyInstance } from 'fastify';

export async function friendsRoutes(app: FastifyInstance) {
  app.get('/api/friends', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const friends = await app.db.getFriends(userId);
      
      // Enrich friends with real-time online status
      const { onlineUsers } = await import('../socket/handler.js');
      const enrichedFriends = friends.map((friend: any) => ({
        ...friend,
        // Override database status with real-time status from socket
        status: onlineUsers.has(friend.id) ? 'online' : 'offline'
      }));
      
      app.log.info(`User ${userId} fetched ${enrichedFriends.length} friends`);
      enrichedFriends.forEach((f: any) => {
        app.log.info(`  → Friend ${f.username} (${f.id}): status=${f.status}, inOnlineUsers=${onlineUsers.has(f.id)}`);
      });
      
      return { friends: enrichedFriends };
    } catch (error: any) {
      app.log.error('Error fetching friends:', error);
      reply.status(500).send({ message: 'Failed to fetch friends', error: error.message });
    }
  });

  app.get('/api/friends/requests', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const requests = await app.db.getFriendRequests(userId);
      return { requests };
    } catch (error: any) {
      app.log.error('Error fetching friend requests:', error);
      reply.status(500).send({ message: 'Failed to fetch friend requests', error: error.message });
    }
  });

  app.post('/api/friends/request', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const senderId = request.user.id;
      const { receiverUsername, receiverId } = request.body as { receiverUsername?: string; receiverId?: number };

      let targetId: number | undefined = receiverId;
      if (receiverUsername && typeof receiverUsername === 'string') {
        const targetUser = await app.db.findUserByUsername(receiverUsername);
        if (!targetUser) {
          return reply.status(404).send({ message: 'User not found' });
        }
        targetId = targetUser.id;
      }
      if (!targetId || typeof targetId !== 'number') {
        return reply.status(400).send({ message: 'receiverUsername (preferred) or receiverId is required' });
      }

      const req = await app.db.sendFriendRequest(senderId, targetId);

      const sender = await app.db.findUserById(senderId);

      const { onlineUsers } = await import('../../src/socket/handler.js');
      const receiverSocketId = onlineUsers.get(targetId);
      if (receiverSocketId) {
        app.io.to(receiverSocketId).emit('friend-request', {
          id: req.id,
          senderId,
          receiverId: targetId,
          status: req.status,
          created_at: req.created_at,
          sender: {
            id: sender.id,
            username: sender.username,
            avatar: sender.avatar
          }
        });
      }

      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        app.io.to(senderSocketId).emit('friend-request-sent', {
          id: req.id,
          receiverId: targetId,
          status: req.status
        });
      }

      return { request: req };
    } catch (error: any) {
      app.log.error('Error sending friend request:', error);
      reply.status(400).send({ message: error.message || 'Failed to send friend request' });
    }
  });

  app.post('/api/friends/respond', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const receiverId = request.user.id;
      const { requestId, accept } = request.body as { requestId: number; accept: boolean };
      if (!requestId || typeof accept !== 'boolean') {
        return reply.status(400).send({ message: 'requestId and accept are required' });
      }

      const updated = await app.db.respondFriendRequest(requestId, receiverId, accept);

      const { onlineUsers } = await import('../../src/socket/handler.js');
      const req = updated; // already has senderId/receiverId
      const notify = (userId: number, payload: any) => {
        const sid = onlineUsers.get(userId);
        if (sid) app.io.to(sid).emit('friend-request-updated', payload);
      };

      notify(req.senderId, { requestId: req.id, status: req.status, otherUserId: req.receiverId });
      notify(req.receiverId, { requestId: req.id, status: req.status, otherUserId: req.senderId });

      if (updated.status === 'accepted') {
        const [sender, receiver] = await Promise.all([
          app.db.findUserById(req.senderId),
          app.db.findUserById(req.receiverId)
        ]);
        const senderSid = onlineUsers.get(req.senderId);
        const receiverSid = onlineUsers.get(req.receiverId);
        if (senderSid) app.io.to(senderSid).emit('friend-added', { type: 'friend-added', friend: receiver });
        if (receiverSid) app.io.to(receiverSid).emit('friend-added', { type: 'friend-added', friend: sender });
      }

      return { request: updated };
    } catch (error: any) {
      app.log.error('Error responding to friend request:', error);
      reply.status(400).send({ message: error.message || 'Failed to respond to friend request' });
    }
  });

  app.delete('/api/friends/:friendId', {
    preHandler: [app.authenticate]
  }, async (request: any, reply: any) => {
    try {
      const { friendId } = request.params as { friendId: string };
      const userId = request.user.id;
      const friendIdNum = parseInt(friendId);

      if (!friendIdNum || isNaN(friendIdNum)) {
        return reply.status(400).send({ message: 'Valid friend ID is required' });
      }

      const areFriends = await app.db.areFriends(userId, friendIdNum);
      if (!areFriends) {
        return reply.status(400).send({ message: 'You are not friends with this user' });
      }

      await app.db.removeFriend(userId, friendIdNum);

      const { onlineUsers } = await import('../../src/socket/handler.js');
      const userSid = onlineUsers.get(userId);
      const friendSid = onlineUsers.get(friendIdNum);
      
      if (userSid) {
        app.io.to(userSid).emit('friend-removed', { userId: friendIdNum });
      }
      if (friendSid) {
        app.io.to(friendSid).emit('friend-removed', { userId: userId });
      }

      return { message: 'Friend removed successfully' };
    } catch (error: any) {
      app.log.error('Error removing friend:', error);
      reply.status(400).send({ message: error.message || 'Failed to remove friend' });
    }
  });
}
