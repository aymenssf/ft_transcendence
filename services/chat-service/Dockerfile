# Builder stage
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY Shared_dataBase ./Shared_dataBase
COPY services ./services

RUN npm install --legacy-peer-deps

WORKDIR /app/Shared_dataBase
RUN npx prisma generate --schema=./prisma/schema.prisma

WORKDIR /app/services/chat-service

RUN npm install
RUN mkdir -p ./node_modules/.prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ && \
    mkdir -p ./node_modules/@prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/
RUN npm run build && ls -la dist/ || (echo "Build failed" && exit 1)

# Production stage
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd -r chatservice -g 1001 && useradd -r -g chatservice -u 1001 -m -s /bin/bash chatservice

WORKDIR /app

COPY --chown=chatservice:chatservice package*.json ./
COPY --chown=chatservice:chatservice Shared_dataBase/package*.json ./Shared_dataBase/
COPY --chown=chatservice:chatservice Shared_dataBase/prisma ./Shared_dataBase/prisma
COPY --chown=chatservice:chatservice services/chat-service/package*.json ./services/chat-service/

WORKDIR /app/Shared_dataBase
RUN npm install --omit=dev
RUN npx prisma generate --schema=./prisma/schema.prisma

WORKDIR /app/services/chat-service
RUN npm install --omit=dev

COPY --from=builder --chown=chatservice:chatservice /app/services/chat-service/dist ./dist

RUN mkdir -p ./node_modules/.prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ && \
    mkdir -p ./node_modules/@prisma && \
    cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/

RUN mkdir -p /app/database && chown -R chatservice:chatservice /app/database

COPY --chown=chatservice:chatservice services/chat-service/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    DATABASE_URL="file:/app/database/transcendence.db" \
    NODE_PATH=./node_modules:/app/services/chat-service/node_modules

USER chatservice

EXPOSE 3011

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3011/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]
