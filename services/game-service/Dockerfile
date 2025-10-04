FROM node:20-alpine

WORKDIR /app/services/game-service

RUN apk add --no-cache sqlite sqlite-dev

COPY services/game-service/package*.json ./
RUN npm install --include=dev
# RUN npm ci --no-audit --no-fund

ENV PATH="/app/services/game-service/node_modules/.bin:$PATH"
ENV NODE_PATH=/app/services/game-service/node_modules

RUN mkdir /app/Shared_dataBase
RUN ln -s /app/services/game-service/node_modules /app/Shared_dataBase/node_modules || true

RUN mkdir -p /app/database && chmod 755 /app/database


CMD ["npm", "run", "dev"]
