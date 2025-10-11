#!/bin/bash
set -e

# ==============================================================================
# AI Service Entrypoint Script
# ==============================================================================

echo "🚀 AI Service starting..."

# Ensure we're in the correct directory
cd /app/services/ai-service

# Ensure Prisma Client is available
echo "📦 Ensuring Prisma Client is available..."
cd /app/Shared_dataBase
npx prisma generate --schema=./prisma/schema.prisma > /dev/null 2>&1 || {
    echo "⚠️  Warning: Prisma generate failed, but continuing..."
}

# Return to ai-service directory
cd /app/services/ai-service

# Link Prisma Client
mkdir -p ./node_modules/.prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/.prisma/ 2>/dev/null || true
mkdir -p ./node_modules/@prisma
cp -r ../../Shared_dataBase/node_modules/@prisma/client ./node_modules/@prisma/ 2>/dev/null || true

echo "✅ Prisma Client ready"
echo "🤖 Starting AI server on port 3013..."

# Execute the main command
exec "$@"
