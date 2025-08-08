#!/bin/bash

# Resource Collector Game Startup Script
echo "🎮 Starting Resource Collector Game..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Проверяем наличие зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to install dependencies!"
        exit 1
    fi
fi

# Запускаем сервер
echo "🚀 Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

npm start
