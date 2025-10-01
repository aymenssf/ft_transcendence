FROM node:20-slim

WORKDIR /app/services/game-service

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/game-service/package*.json ./
RUN npm ci --no-audit --no-fund

ENV NODE_PATH=/app/services/game-service/node_modules
ENV PATH="$PATH:/app/services/game-service/node_modules/.bin"

COPY services/game-service/ ./
COPY Shared_dataBase/ /app/Shared_dataBase/

RUN ln -s /app/services/game-service/node_modules /app/Shared_dataBase/node_modules || true

RUN mkdir -p /app/database && chmod 755 /app/database

RUN npm run build


EXPOSE 3012

CMD ["node", "dist/server.js"]
