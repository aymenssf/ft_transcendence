#!/bin/bash
set -e

# ==============================================================================
# Chat Service Entrypoint Script
# This script handles startup logic including Prisma Client setup
# ==============================================================================

echo "🚀 Chat Service starting..."

# Ensure we're in the correct directory
cd /app/services/chat-service

# Ensure Prisma Client is available (regenerate if needed)
echo "📦 Ensuring Prisma Client is available..."
cd /app/Shared_dataBase
npx prisma generate --schema=./prisma/schema.prisma > /dev/null 2>&1 || {
    echo "⚠️  Warning: Prisma generate failed, but continuing..."
}

# Return to chat-service directory
cd /app/services/chat-service

# Link Prisma Client (ensure it's accessible)
mkdir -p ./node_modules/.prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ 2>/dev/null || true
mkdir -p ./node_modules/@prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/ 2>/dev/null || true

echo "✅ Prisma Client ready"
echo "🌐 Starting server on port 3011..."

# Execute the main command (passed as arguments to this script)
exec "$@"
