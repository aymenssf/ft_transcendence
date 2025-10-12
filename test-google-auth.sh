#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 FT Transcendence - Google OAuth Test Setup${NC}\n"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${RED}❗ IMPORTANT: Edit .env and add your Google OAuth credentials!${NC}\n"
    echo "GOOGLE_CLIENT_ID=your_client_id_here"
    echo "GOOGLE_CLIENT_SECRET=your_client_secret_here"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
fi

# Check if Google credentials are set
if grep -q "your_google_client_id_here" .env; then
    echo -e "${RED}❌ Please update GOOGLE_CLIENT_ID in .env file${NC}"
    exit 1
fi

if grep -q "your_google_client_secret_here" .env; then
    echo -e "${RED}❌ Please update GOOGLE_CLIENT_SECRET in .env file${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}\n"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd services/auth-service
npm install passport passport-google-oauth20 @types/passport @types/passport-google-oauth20 --save
cd ../..

echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Build and start containers
echo -e "${BLUE}🐳 Building and starting Docker containers...${NC}"
docker-compose up --build -d frontend auth-service

echo -e "\n${GREEN}✅ Services started!${NC}\n"

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check if services are running
if docker ps | grep -q "ft_transcendence_frontend"; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
fi

if docker ps | grep -q "ft_transcendence_auth"; then
    echo -e "${GREEN}✅ Auth service is running${NC}"
else
    echo -e "${RED}❌ Auth service failed to start${NC}"
fi

echo -e "\n${BLUE}📊 Service Status:${NC}"
echo "Frontend:     http://localhost:3000"
echo "Auth Service: http://localhost:3010"

echo -e "\n${BLUE}📝 Next Steps:${NC}"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Sign in with Google'"
echo "3. Authorize with your Google account"

echo -e "\n${BLUE}🔍 View Logs:${NC}"
echo "docker-compose logs -f auth-service"
echo "docker-compose logs -f frontend"

echo -e "\n${BLUE}🛑 Stop Services:${NC}"
echo "docker-compose down"

echo -e "\n${GREEN}🎉 Setup complete! Happy testing!${NC}\n"
