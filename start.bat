@echo off
title Resource Collector Game

echo 🎮 Starting Resource Collector Game...

REM Проверяем наличие Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Проверяем наличие зависимостей
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Error: Failed to install dependencies!
        pause
        exit /b 1
    )
)

REM Запускаем сервер
echo 🚀 Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm start
