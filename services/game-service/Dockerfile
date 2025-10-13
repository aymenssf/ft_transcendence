FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Shared_dataBase first
COPY Shared_dataBase/package*.json ./Shared_dataBase/
COPY Shared_dataBase/prisma ./Shared_dataBase/prisma/
COPY Shared_dataBase/prismaClient.ts ./Shared_dataBase/
COPY Shared_dataBase/prismaClient.js ./Shared_dataBase/
COPY Shared_dataBase/prismaClient.d.ts ./Shared_dataBase/

WORKDIR /app/Shared_dataBase
RUN npm install
RUN npx prisma generate

# Now build game service
WORKDIR /app/services/game-service
COPY services/game-service/package*.json ./
# Install runtime + dev dependencies at image build so `tsc` is available for the build step
RUN npm install --include=dev

COPY services/game-service ./
RUN npm run build

ENV DATABASE_URL="file:/app/database/transcendence.db"

RUN mkdir -p /app/database && chmod 755 /app/database

EXPOSE 3012

CMD ["sh", "-c", "cd /app/Shared_dataBase && npx prisma migrate deploy && cd /app/services/game-service && node dist/src/server.js"]