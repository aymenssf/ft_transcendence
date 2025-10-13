import { FastifyInstance } from 'fastify';
import { onlineUsers } from '../socket/handler.js';

interface TournamentNotificationBody {
  userId: number;
  tournamentId: number;
  title: string;
  message: string;
  type: string;
}

interface MarkReadBody {
  notificationId: number;
}

export async function tournamentRoutes(app: FastifyInstance) {
  // Create tournament notification (called by game-service)
  app.post('/api/tournament/notify', async (request: any, reply) => {
    try {
      const { userId, tournamentId, title, message, type } = request.body as TournamentNotificationBody;

      if (!userId || !tournamentId || !title || !message) {
        return reply.status(400).send({
          message: 'Missing required fields: userId, tournamentId, title, message'
        });
      }

      // Create notification in database
      const notification = await app.db.createTournamentNotification(
        userId,
        tournamentId,
        title,
        message,
        type || 'match'
      );

      // Send real-time notification if user is online
      const userSocketId = onlineUsers.get(userId);
      if (userSocketId) {
        app.io.to(userSocketId).emit('tournament-notification', {
          id: notification.id,
          tournamentId: notification.tournamentId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          created_at: notification.created_at
        });
      }

      return {
        message: 'Tournament notification sent successfully',
        notification: {
          id: notification.id,
          userId: notification.userId,
          tournamentId: notification.tournamentId,
          title: notification.title
        }
      };
    } catch (error: any) {
      app.log.error('Error creating tournament notification:', error);
      reply.status(500).send({
        message: 'Failed to create tournament notification',
        error: error.message
      });
    }
  });

  // Bulk create tournament notifications
  app.post('/api/tournament/notify-bulk', async (request: any, reply) => {
    try {
      const { notifications } = request.body as { notifications: TournamentNotificationBody[] };

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return reply.status(400).send({
          message: 'notifications array is required and must not be empty'
        });
      }

      const createdNotifications = [];

      for (const notif of notifications) {
        const { userId, tournamentId, title, message, type } = notif;

        if (!userId || !tournamentId || !title || !message) {
          continue; // Skip invalid entries
        }

        // Create notification
        const notification = await app.db.createTournamentNotification(
          userId,
          tournamentId,
          title,
          message,
          type || 'match'
        );

        createdNotifications.push(notification);

        // Send real-time notification if user is online
        const userSocketId = onlineUsers.get(userId);
        if (userSocketId) {
          app.io.to(userSocketId).emit('tournament-notification', {
            id: notification.id,
            tournamentId: notification.tournamentId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            created_at: notification.created_at
          });
        }
      }

      return {
        message: `Sent ${createdNotifications.length} tournament notifications`,
        count: createdNotifications.length
      };
    } catch (error: any) {
      app.log.error('Error creating bulk tournament notifications:', error);
      reply.status(500).send({
        message: 'Failed to create tournament notifications',
        error: error.message
      });
    }
  });

  // Get user's tournament notifications
  app.get('/api/tournament/notifications', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const { unreadOnly } = request.query as { unreadOnly?: string };

      const notifications = await app.db.getUserTournamentNotifications(
        userId,
        unreadOnly === 'true'
      );

      return {
        notifications,
        count: notifications.length
      };
    } catch (error: any) {
      app.log.error('Error fetching tournament notifications:', error);
      reply.status(500).send({
        message: 'Failed to fetch tournament notifications',
        error: error.message
      });
    }
  });

  // Mark notification as read
  app.post('/api/tournament/notifications/read', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { notificationId } = request.body as MarkReadBody;
      const userId = request.user.id;

      if (!notificationId) {
        return reply.status(400).send({ message: 'Notification ID is required' });
      }

      // Verify notification belongs to user
      const { prisma } = await import('@ft/shared-database');

      const notification = await prisma.tournamentNotification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        return reply.status(404).send({ message: 'Notification not found' });
      }

      if (notification.userId !== userId) {
        return reply.status(403).send({ message: 'Not authorized' });
      }

      await prisma.$disconnect();

      // Mark as read
      await app.db.markNotificationAsRead(notificationId);

      return {
        message: 'Notification marked as read',
        notificationId
      };
    } catch (error: any) {
      app.log.error('Error marking notification as read:', error);
      reply.status(500).send({
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  });

  // Mark all notifications as read
  app.post('/api/tournament/notifications/read-all', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;

      const { prisma } = await import('@ft/shared-database');

      await prisma.tournamentNotification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      return {
        message: 'All notifications marked as read'
      };
    } catch (error: any) {
      app.log.error('Error marking all notifications as read:', error);
      reply.status(500).send({
        message: 'Failed to mark all notifications as read',
        error: error.message
      });
    }
  });
}
