#!/bin/bash

# Chat Service Prisma Testing Script
# Make sure the services are running: docker-compose up

echo "🧪 Testing Chat Service with Prisma..."
echo "======================================="

BASE_URL="http://localhost:3011"

echo ""
echo "1. 🏥 Health Check"
echo "-------------------"
curl -s "$BASE_URL/health" | jq '.'

echo ""
echo "2. 🔗 Database Connection Test" 
echo "--------------------------------"
curl -s "$BASE_URL/db-test" | jq '.'

echo ""
echo "3. 👥 Get All Users (Direct Prisma query)"
echo "-------------------------------------------"
curl -s "$BASE_URL/test/users" | jq '.'

echo ""
echo "4. 🏠 Create a Test Chat Room"
echo "------------------------------"
# First, let's assume user with ID 1 exists (created by auth-service)
curl -s -X POST "$BASE_URL/test/chatroom" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "General Chat",
    "type": "public", 
    "ownerId": 1
  }' | jq '.'

echo ""
echo "5. 📋 Get Chat Rooms for User 1"
echo "--------------------------------"
curl -s "$BASE_URL/test/chatrooms/1" | jq '.'

echo ""
echo "6. 🔍 Get Specific Chat Room (ID: 1)"
echo "-------------------------------------"
curl -s "$BASE_URL/test/chatroom/1" | jq '.'

echo ""
echo "✅ Chat Service Prisma Testing Complete!"
echo "========================================="