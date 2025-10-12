export const config = {
  server: {
    port: parseInt(process.env.PORT || '3011'),
    host: process.env.HOST || '0.0.0.0',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'transcendence-secret-key',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  socketio: {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      credentials: true,
    },
  },
};
