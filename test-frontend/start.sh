#!/bin/bash

# 🧪 Quick Test Frontend Launcher
# This script starts a simple HTTP server for testing authentication

echo "🚀 Starting Test Frontend for ft_transcendence Authentication..."
echo ""

# Check if we're in the correct directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found!"
    echo "Please run this script from the test-frontend directory"
    exit 1
fi

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 1
    else
        return 0
    fi
}

# Check if port 3000 is available
if ! check_port 3000; then
    echo "⚠️  Port 3000 is already in use!"
    echo "Please stop the service using port 3000 or change the port in this script"
    exit 1
fi

echo "✅ Port 3000 is available"
echo ""
echo "📍 Main Test Page: http://localhost:3000/index.html"
echo "🔗 Make sure your auth-service is running at: http://localhost:3010"
echo ""
echo "🧪 Test the complete OAuth flow:"
echo "   1. Click '🚀 Login with 42 School' button"
echo "   2. Authorize the application on 42"
echo "   3. Get redirected back with authentication"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to open browser
open_browser() {
    sleep 2
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000/index.html" &
    elif command -v open &> /dev/null; then
        open "http://localhost:3000/index.html" &
    elif command -v start &> /dev/null; then
        start "http://localhost:3000/index.html" &
    else
        echo "💡 Manually open: http://localhost:3000/index.html"
    fi
}

# Try different methods to start HTTP server
if command -v python3 &> /dev/null; then
    echo "🐍 Using Python 3..."
    open_browser &
    python3 -m http.server 3000
elif command -v python &> /dev/null; then
    echo "🐍 Using Python..."
    open_browser &
    python -m SimpleHTTPServer 3000
elif command -v php &> /dev/null; then
    echo "🐘 Using PHP..."
    open_browser &
    php -S localhost:3000
else
    echo "❌ No suitable HTTP server found!"
    echo ""
    echo "Please install one of the following:"
    echo "  • Python 3: sudo apt install python3"
    echo "  • Node.js http-server: npm install -g http-server"
    echo "  • Or use VS Code Live Server extension"
    exit 1
fi
