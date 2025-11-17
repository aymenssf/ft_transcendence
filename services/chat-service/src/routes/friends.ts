import { FastifyInstance } from 'fastify';

export async function friendsRoutes(app: FastifyInstance) {
  // Get current user's friends
  app.get('/api/friends', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const friends = await app.db.getFriends(userId);
      return { friends };
    } catch (error: any) {
      app.log.error('Error fetching friends:', error);
      reply.status(500).send({ message: 'Failed to fetch friends', error: error.message });
    }
  });

  // Get incoming friend requests (pending)
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

  // Send a friend request (by username preferred)
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

      // Notify receiver via socket if online
      const { onlineUsers } = await import('../../src/socket/handler.js');
      const receiverSocketId = onlineUsers.get(targetId);
      if (receiverSocketId) {
        app.io.to(receiverSocketId).emit('friend-request', {
          id: req.id,
          senderId,
          receiverId: targetId,
          status: req.status,
          created_at: req.created_at
        });
      }

      return { request: req };
    } catch (error: any) {
      app.log.error('Error sending friend request:', error);
      reply.status(400).send({ message: error.message || 'Failed to send friend request' });
    }
  });

  // Respond to a friend request (accept/decline)
  app.post('/api/friends/respond', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const receiverId = request.user.id;
      const { requestId, accept } = request.body as { requestId: number; accept: boolean };
      if (!requestId || typeof accept !== 'boolean') {
        return reply.status(400).send({ message: 'requestId and accept are required' });
      }

      const updated = await app.db.respondFriendRequest(requestId, receiverId, accept);

      // Notify both parties
      const { onlineUsers } = await import('../../src/socket/handler.js');
      const req = updated; // already has senderId/receiverId
      const notify = (userId: number, payload: any) => {
        const sid = onlineUsers.get(userId);
        if (sid) app.io.to(sid).emit('friend-request-updated', payload);
      };

      notify(req.senderId, { requestId: req.id, status: req.status, otherUserId: req.receiverId });
      notify(req.receiverId, { requestId: req.id, status: req.status, otherUserId: req.senderId });

      // If accepted, also notify about new friend added
      if (updated.status === 'accepted') {
        const [sender, receiver] = await Promise.all([
          app.db.findUserById(req.senderId),
          app.db.findUserById(req.receiverId)
        ]);
        notify(req.senderId, { type: 'friend-added', friend: receiver });
        notify(req.receiverId, { type: 'friend-added', friend: sender });
      }

      return { request: updated };
    } catch (error: any) {
      app.log.error('Error responding to friend request:', error);
      reply.status(400).send({ message: error.message || 'Failed to respond to friend request' });
    }
  });
}
