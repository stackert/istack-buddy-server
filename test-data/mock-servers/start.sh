#!/bin/bash

# iStack Buddy Information Services Mock Server Startup Script

echo "🚀 Starting iStack Buddy Information Services Mock Server..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the mock-servers directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to install dependencies"
        exit 1
    fi
fi

# Start the server
echo "🌟 Starting mock server on http://localhost:3001"
echo "📋 Press Ctrl+C to stop the server"
echo ""

node information-services-mock.js
