FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent 2>/dev/null || npm install --silent

COPY . .

# Optional build-time overrides. Vite inlines import.meta.env at build time, so
# these MUST arrive as build args — docker-compose `env_file` is applied at run
# time and would be too late. All of them default to same-origin relative paths
# that nginx.conf already proxies, so the standard build needs none of them.
ARG VITE_AUTH_API_URL
ARG VITE_CHAT_API_URL
ARG VITE_GAME_API_URL
ARG VITE_CHAT_SOCKET_URL
ARG VITE_CHAT_SOCKET_PATH
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL \
    VITE_CHAT_API_URL=$VITE_CHAT_API_URL \
    VITE_GAME_API_URL=$VITE_GAME_API_URL \
    VITE_CHAT_SOCKET_URL=$VITE_CHAT_SOCKET_URL \
    VITE_CHAT_SOCKET_PATH=$VITE_CHAT_SOCKET_PATH

# Vite emits a self-contained dist/: hashed JS+CSS under dist/assets and a
# rewritten dist/index.html pointing at them.
RUN npm run build


FROM nginx:alpine

# Vite's dist/ becomes the nginx document root directly. nginx.conf is unchanged
# and its `location /` try_files fallback serves index.html for client routes,
# while `location ~ \.js$` serves the hashed asset files.
COPY --from=builder /app/dist /usr/share/nginx/html

# Avatars and other static art referenced by absolute /images/... URLs.
COPY --chown=nginx:nginx images /usr/share/nginx/html/images
COPY fonts /usr/share/nginx/html/fonts

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
