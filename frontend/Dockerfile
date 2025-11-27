FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --silent

COPY . .

RUN npx tsc

RUN npx tailwindcss -c tailwind.config.js -i ./src/styles/tailwind.css -o ./dist/styles/tailwind.css --minify



FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/src/styles/fonts.css /usr/share/nginx/html/dist/styles
COPY index.html /usr/share/nginx/html/index.html
COPY --chown=nginx:nginx images /usr/share/nginx/html/images
COPY fonts /usr/share/nginx/html/fonts

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]

