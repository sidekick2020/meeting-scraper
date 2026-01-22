#!/bin/bash
# Start frontend dev server with hot reload
# Usage: ./dev.sh

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting dev server at http://localhost:3000"
echo "Press Ctrl+C to stop"
npm start
