#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎮 Starting Resource Collector Game...');

// Проверяем наличие package.json
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found!');
    console.error('Please run this script from the game directory.');
    process.exit(1);
}

// Проверяем наличие зависимостей
if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    
    const npmInstall = spawn('npm', ['install'], {
        stdio: 'inherit',
        shell: true
    });
    
    npmInstall.on('close', (code) => {
        if (code !== 0) {
            console.error('❌ Error: Failed to install dependencies!');
            process.exit(1);
        }
        startServer();
    });
} else {
    startServer();
}

function startServer() {
    console.log('🚀 Starting server on http://localhost:3000');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
    
    // Автоматически открываем браузер через 2 секунды
    setTimeout(() => {
        const open = require('child_process').exec;
        const url = 'http://localhost:3000';
        
        // Определяем команду для открытия браузера по ОС
        let cmd;
        switch (process.platform) {
            case 'darwin':
                cmd = `open ${url}`;
                break;
            case 'win32':
                cmd = `start ${url}`;
                break;
            default:
                cmd = `xdg-open ${url}`;
        }
        
        open(cmd, (error) => {
            if (!error) {
                console.log('🌐 Opening browser...');
            }
        });
    }, 2000);
    
    // Запускаем сервер
    const server = spawn('node', ['src/server.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    server.on('close', (code) => {
        console.log(`\n👋 Server stopped with code ${code}`);
    });
    
    // Обрабатываем Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping server...');
        server.kill();
        process.exit(0);
    });
}
