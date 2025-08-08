# ResourceCollectorGame
Web Game for Kood Johvi

## Быстрый запуск

### Способ 1: Автоматический скрипт (рекомендуется)
```bash
# macOS/Linux
./start.sh

# Windows
start.bat

# Универсальный (любая ОС)
node start.js
```

### Способ 2: NPM команды
```bash
# Установка зависимостей (если нужно)
npm install

# Запуск сервера
npm start
# или
npm run dev
```

### Способ 3: Ручной запуск
```bash
# Установка зависимостей
npm install

# Запуск сервера
node src/server.js
```

## Установка

### Предварительные требования
- Node.js (рекомендуется версия 16 или выше)
- npm (обычно устанавливается с Node.js)

### Установка зависимостей
1. Склонируйте репозиторий:
```bash
git clone https://github.com/icymust/ResourceCollectorGame.git
cd ResourceCollectorGame
```

2. Установите зависимости из package.json:
```bash
npm install
```

Это установит следующие зависимости:
- `express` - веб-фреймворк для сервера
- `socket.io` - библиотека для работы с WebSocket соединениями

## Запуск

### Запуск сервера
Запустите сервер с помощью команды:
```bash
node src/server.js
```

После успешного запуска сервер будет доступен по адресу `http://localhost:3000` (или другому порту, указанному в коде сервера).

### Открытие игры
1. Убедитесь, что сервер запущен
2. Откройте веб-браузер
3. Перейдите по адресу `http://localhost:3000`
4. Начните играть!

## Удаленный доступ через ngrok

Для того чтобы друзья могли подключиться к вашей игре через интернет, используйте ngrok:

### Установка ngrok

**macOS (через Homebrew):**
```bash
brew install ngrok/ngrok/ngrok
```

**Или скачайте с официального сайта:**
1. Идите на https://ngrok.com/
2. Зарегистрируйтесь и скачайте ngrok
3. Распакуйте в удобную папку

### Настройка authtoken
```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```
*(Ваш authtoken можно найти в личном кабинете ngrok)*

### Запуск с ngrok

**Вариант 1: Отдельные терминалы**
```bash
# Терминал 1 - запуск сервера
npm start

# Терминал 2 - запуск ngrok
ngrok http 3000
```

**Вариант 2: Одной командой (если установлен concurrently)**
```bash
# Установите зависимости для разработки
npm install -D nodemon concurrently

# Запустите сервер и ngrok одновременно
npm run dev-tunnel
```

### Использование ngrok URL

После запуска ngrok вы увидите что-то вроде:
```
Session Status: online
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

Теперь игроки могут подключаться по адресу `https://abc123.ngrok.io`

### Дополнительные команды NPM

Добавьте в ваш `package.json` следующие скрипты:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "tunnel": "ngrok http 3000",
    "dev-tunnel": "concurrently \"npm run dev\" \"ngrok http 3000 --log=stdout\"",
    "install-dev": "npm install -D nodemon concurrently"
  }
}
```

### Важные заметки о ngrok
- 🔄 Бесплатный ngrok меняет URL при каждом перезапуске
- ⏰ URL остается активным пока работает ngrok
- 💰 Для постоянного URL нужна платная подписка
- 🔒 Все соединения через ngrok зашифрованы (HTTPS)

### Проверка состояния сервера
Вы можете проверить статус сервера через:
- Локально: `http://localhost:3000/health`
- Через ngrok: `https://your-ngrok-url.ngrok.io/health`

