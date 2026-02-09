# Agula Manager - מנהל עגולה

A safety-critical diver pair check-in management system. Monitors diving pairs ("carts"/עגלות) with 60-minute check-in timers — failure to check in triggers emergency alerts. Built for use on boats with Hebrew RTL interface, offline support, and mobile-responsive design.

## Features

- **60-minute check-in timer** per cart with color-coded status (green/orange/red)
- **Two-phase check-in flow**: הזדהות (pause) → עגולה חדשה (new round)
- **5-minute rounded deadlines** for analog clock readability
- **Real-time updates** via Socket.io
- **Audio alerts** when timers expire
- **Offline support** (PWA with IndexedDB)
- **Dark mode** and Hebrew RTL interface
- **Reports & export** (CSV, Excel, PDF)
- **Cart import** from file
- **Emergency protocols** management

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3, WAL mode) |
| Real-time | Socket.io |
| Offline | Service Worker, Dexie.js (IndexedDB) |
| Testing | Playwright |

## Project Structure

```
AgulaManager/
├── client/          # React + Vite frontend
├── server/          # Express + SQLite backend
├── shared/          # Shared TypeScript types
├── e2e/             # Playwright end-to-end tests
└── package.json     # Root workspace config
```

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

## Development Setup

```bash
# 1. Clone the repo
git clone git@github.com:menakerman/AgulaManager.git
cd AgulaManager

# 2. Install all dependencies (client, server, shared)
npm install

# 3. Start both servers (server on :3001, client on :5173)
npm run dev
```

This starts:
- **Backend**: http://localhost:3001 (Express + Socket.io + SQLite)
- **Frontend**: http://localhost:5173 (Vite dev server with HMR)

The Vite dev server proxies `/api` and `/socket.io` requests to the backend automatically.

### Start servers individually

```bash
# Backend only
npm run dev --workspace=server

# Frontend only
npm run dev --workspace=client
```

## Production Build & Deployment

### 1. Build

```bash
npm run build
```

This compiles the TypeScript server and builds the Vite client into `client/dist/`.

### 2. Run in production

```bash
npm start
```

This starts the Express server which serves both the API and the built client static files.

### 3. Deploy to a server

```bash
# On the server machine:
git clone git@github.com:menakerman/AgulaManager.git
cd AgulaManager
npm install
npm run build
npm start
```

The app runs on port **3001** by default. Use a reverse proxy (nginx, Caddy) to expose it on port 80/443.

#### Example nginx config

```nginx
server {
    listen 80;
    server_name agula.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

The `Upgrade` and `Connection` headers are required for Socket.io WebSocket connections.

### 4. Run with PM2 (recommended for production)

```bash
npm install -g pm2
npm run build
pm2 start npm --name "agula" -- start
pm2 save
pm2 startup  # auto-start on reboot
```

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |

The SQLite database is created automatically at `server/data/agula.db` on first run. Backups are taken every 30 minutes to `server/data/backups/`.

## Usage Guide

### Creating a Cart (עגלה)

1. Click **"עגלה חדשה"** (New Cart)
2. Enter the cart number
3. Select the type: זוג (pair/2), שלישייה (trio/3), or שישייה (six/6)
4. Enter the diver names
5. Click **"הוסף עגלה"** (Add Cart)

A 60-minute timer starts immediately. The deadline is rounded to the nearest 5 minutes (e.g., 09:35, 09:40, 09:45) so divers can read it on an analog clock.

### Check-in Flow

Each cart card displays:
- **ניתנה** — when the current round was given
- **עגולה עד** — the deadline (rounded to 5 min)
- **Countdown timer** with color-coded status

**Step 1: הזדהות (Identification)**
When divers check in, press **"הזדהות"**. This pauses the timer and shows the projected next deadline in real-time.

**Step 2: עגולה חדשה (New Round)**
Press **"עגולה חדשה"** to start a new 60-minute round. The new deadline is rounded to the nearest 5 minutes.

### Timer Status Colors

| Color | Meaning |
|-------|---------|
| Green | More than 15 minutes remaining |
| Orange | 5–15 minutes remaining |
| Red | Less than 5 minutes / expired |

### Ending a Cart

Click the three-dot menu (⋮) on a cart card and select **"סיום פעילות"** (End Activity).

### Search & Filter

Use the search bar to find carts by number or diver name. Filter by status using the tabs: הכל (All), תקין (OK), אזהרה (Warning), פג (Expired).

### Import Carts

Click **"ייבוא"** (Import) to bulk-import carts from a CSV/Excel file.

### Reports & Export

Navigate to **"דוחות"** (Reports) to view summaries and export data as CSV, Excel, or PDF.

### Dark Mode

Click the moon/sun icon in the top bar to toggle dark mode.

## Running Tests

```bash
# Install Playwright browsers (first time)
npx playwright install chromium

# Run all e2e tests
npx playwright test

# Run with visible browser
npx playwright test --headed

# Run specific test
npx playwright test -g "full check-in flow"
```

## Database

SQLite database at `server/data/agula.db` (WAL mode for concurrent reads). Auto-created on first start.

**Backup**: Automatic every 30 minutes to `server/data/backups/`. To manually backup, copy `agula.db`.

**Reset**: Delete `server/data/` and restart the server.

## License

Private project.
