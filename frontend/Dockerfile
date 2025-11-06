
# -------- Build Stage --------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json* ./
COPY package*.json ./
RUN npm install --silent

# Copy TypeScript config and source
COPY . .

# Build TypeScript
RUN npx tsc

# Build Tailwind CSS
RUN npx tailwindcss -c tailwind.config.js -i ./styles/tailwind.css -o ./dist/styles/tailwind.css --minify

# Copy other styles (global/dashboard) into dist
RUN mkdir -p dist/styles
COPY styles/ ./dist/styles/

# -------- NGINX Stage --------
FROM nginx:alpine

# Copy built frontend into NGINX html directory
COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY index.html /usr/share/nginx/html/index.html
COPY --chown=nginx:nginx images /usr/share/nginx/html/images
COPY fonts /usr/share/nginx/html/fonts
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy fonts folder


EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
