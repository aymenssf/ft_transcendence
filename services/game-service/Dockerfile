FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- Shared_dataBase ----------
COPY Shared_dataBase/package*.json ./Shared_dataBase/
COPY Shared_dataBase/prisma ./Shared_dataBase/prisma/
COPY Shared_dataBase/prismaClient.ts ./Shared_dataBase/
COPY Shared_dataBase/prismaClient.js ./Shared_dataBase/
COPY Shared_dataBase/prismaClient.d.ts ./Shared_dataBase/

WORKDIR /app/Shared_dataBase
RUN npm install
RUN npx prisma generate

# ---------- Game service ----------
WORKDIR /app/services/game-service

# Install deps first (better layer cache)
COPY services/game-service/package*.json ./
RUN npm install @fastify/cors@^8
RUN npm install --include=dev

# Copy the rest of the game-service code (including prisma/)
COPY services/game-service ./

# DB *inside* prisma folder, relative to /app/services/game-service
ENV DATABASE_URL="file:./prisma/transcendence.db"

# Build TS
RUN npm run build

# Generate Prisma client for game-service
RUN npx prisma generate

# SSL keys
RUN mkdir -p /keys && \
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /keys/key.pem \
      -out /keys/cert.pem \
      -subj "/C=MA/ST=None/L=None/O=transcendence_game/OU=Dev/CN=localhost" \
      -days 365

EXPOSE 3012

# Run migrations from the project root (NOT from prisma/)
CMD ["sh", "-c", "cd /app/services/game-service && npx prisma migrate deploy && npm run dev"]
