# -------- Build Stage --------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --silent

# Copy source & styles
COPY . .

# Build TypeScript
RUN npx tsc

# Build Tailwind CSS (use source file, not the one in dist)
RUN npx tailwindcss -c tailwind.config.js -i ./src/styles/tailwind.css -o ./dist/styles/tailwind.css --minify


# -------- NGINX Stage --------
# -------- NGINX Stage --------
FROM nginx:alpine

# Copy everything from builder's dist
COPY --from=builder /app/dist /usr/share/nginx/html/dist
# COPY --from=builder /app/dist/styles/tailwind.css /usr/share/nginx/html/dist/styles/tailwind.css

# Ensure fonts and images are copied
COPY index.html /usr/share/nginx/html/index.html
COPY --chown=nginx:nginx images /usr/share/nginx/html/images
COPY fonts /usr/share/nginx/html/fonts

# NGINX config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]

