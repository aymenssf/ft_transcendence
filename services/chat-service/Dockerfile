FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy workspace package files
COPY package*.json ./

# Copy shared database and services
COPY Shared_dataBase ./Shared_dataBase
COPY services ./services

# Install root workspace dependencies
RUN npm install --legacy-peer-deps

# Generate Prisma Client in Shared_dataBase
WORKDIR /app/Shared_dataBase
RUN npx prisma generate --schema=./prisma/schema.prisma

# Switch to chat-service directory
WORKDIR /app/services/chat-service

# Install chat-service dependencies
RUN npm install

# Link Prisma Client from Shared_dataBase
RUN mkdir -p ./node_modules/.prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ && \
    mkdir -p ./node_modules/@prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/

# Build the chat service
RUN npm run build && ls -la dist/ || (echo "Build failed or dist directory not created" && exit 1)

# Environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/database/transcendence.db"

# Create database directory with proper permissions
RUN mkdir -p /app/database && chmod 755 /app/database

# Expose chat service port
EXPOSE 3011

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3011/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Startup script with automation
CMD ["sh", "-c", "\
  echo '🚀 Chat Service starting...' && \
  echo '📦 Ensuring Prisma Client is available...' && \
  cd /app/Shared_dataBase && \
  npx prisma generate --schema=./prisma/schema.prisma > /dev/null 2>&1 && \
  cd /app/services/chat-service && \
  mkdir -p ./node_modules/.prisma && \
  cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ && \
  mkdir -p ./node_modules/@prisma && \
  cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/ && \
  echo '✅ Prisma Client ready' && \
  echo '🌐 Starting server on port 3011...' && \
  DATABASE_URL='file:/app/database/transcendence.db' NODE_PATH=./node_modules:/app/services/chat-service/node_modules node dist/src/server.js \
"]
