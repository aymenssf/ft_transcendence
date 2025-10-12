import { FastifyInstance } from 'fastify';
import { Socket } from 'socket.io';

export function registerSocketEvents(app: FastifyInstance, socket: Socket) {
  const userId = socket.user?.id;

  // Join a chat room
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    app.log.info(`User ${userId} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined-room', { userId, roomId });
  });

  // Leave a chat room
  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId);
    app.log.info(`User ${userId} left room ${roomId}`);
    socket.to(roomId).emit('user-left-room', { userId, roomId });
  });

  // Send message to room
  socket.on('send-message', async (data: { roomId: string; content: string }) => {
    try {
      const { roomId, content } = data;

      // TODO: Save message to database
      // const message = await db.createMessage(userId, parseInt(roomId), content);

      // Broadcast message to room
      app.io.to(roomId).emit('new-message', {
        roomId,
        content,
        senderId: userId,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (roomId: string) => {
    socket.to(roomId).emit('user-typing', { userId, roomId });
  });

  // Stop typing indicator
  socket.on('stop-typing', (roomId: string) => {
    socket.to(roomId).emit('user-stop-typing', { userId, roomId });
  });
}
