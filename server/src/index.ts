import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

import { createApp } from './app';
import { getDatabase, closeDatabase } from './db/database';
import { timerService } from './services/timerService';
import { alertService } from './services/alertService';
import { backupService } from './services/backupService';

const PORT = process.env.PORT || 3001;

const app = createApp();
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Store io instance for routes
app.set('io', io);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// Serve built client in production
// Project root: walk up from __dirname until we find package.json with workspaces
let projectRoot = __dirname;
while (projectRoot !== path.dirname(projectRoot)) {
  const pkg = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkg)) {
    try {
      const content = JSON.parse(fs.readFileSync(pkg, 'utf-8'));
      if (content.workspaces) break;
    } catch {}
  }
  projectRoot = path.dirname(projectRoot);
}
const clientDist = path.join(projectRoot, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/socket.io') || _req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('cart:subscribe', () => {
    const carts = timerService.getActiveCartsWithTimers();
    socket.emit('timer:tick', carts);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Initialize database
getDatabase();

// Initialize services
timerService.init(io);
alertService.init(io);
backupService.start(30);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  timerService.stop();
  backupService.stop();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  timerService.stop();
  backupService.stop();
  closeDatabase();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
