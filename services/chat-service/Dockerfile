FROM node:20-slim

RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

COPY Shared_dataBase ./Shared_dataBase
COPY services ./services

RUN npm install --legacy-peer-deps

RUN npm run prisma:generate



WORKDIR /app/services/chat-service

RUN npm install 

RUN mkdir -p ./node_modules/.prisma && cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/
RUN mkdir -p ./node_modules/@prisma && cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/

RUN npm run build && ls -la dist/ || (echo "Build failed or dist directory not created" && exit 1)

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/database/transcendence.db"

RUN mkdir -p /app/database && chmod 755 /app/database

EXPOSE 3011

CMD ["sh", "-c", "cd /app/services/chat-service && npm run prisma:generate > /dev/null 2>&1 && mkdir -p ./node_modules/.prisma && cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ && mkdir -p ./node_modules/@prisma && cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/ && echo 'Chat service starting...' && DATABASE_URL='file:/app/database/transcendence.db' NODE_PATH=./node_modules:/app/services/chat-service/node_modules node dist/server.js"]
