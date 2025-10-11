#!/bin/bash
set -e

# ==============================================================================
# Auth Service Entrypoint Script
# ==============================================================================

echo "🚀 Auth Service starting..."

# Ensure we're in the correct directory
cd /app/services/auth-service

# Run database migrations (if needed)
echo "📦 Running database migrations..."
cd /app/Shared_dataBase
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || {
    echo "⚠️  Warning: Migration failed or no migrations to apply"
}

# Ensure Prisma Client is available
echo "📦 Ensuring Prisma Client is available..."
npx prisma generate --schema=./prisma/schema.prisma > /dev/null 2>&1 || {
    echo "⚠️  Warning: Prisma generate failed, but continuing..."
}

# Return to auth-service directory
cd /app/services/auth-service

# Link Prisma Client
mkdir -p ./node_modules/.prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ 2>/dev/null || true
mkdir -p ./node_modules/@prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/ 2>/dev/null || true

echo "✅ Prisma Client ready"
echo "🌐 Starting server on port 3010..."

# Execute the main command
exec "$@"
