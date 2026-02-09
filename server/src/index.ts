import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

import { getDatabase, closeDatabase } from './db/database';
import { timerService } from './services/timerService';
import { alertService } from './services/alertService';
import { backupService } from './services/backupService';
import { auditLog } from './middleware/auditLog';

import cartsRouter from './routes/carts';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import filesRouter from './routes/files';
import reportsRouter from './routes/reports';

const PORT = process.env.PORT || 3001;

const app = express();
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

// Middleware
app.use(cors({
  origin: allowedOrigins,
}));
app.use(express.json());
app.use(auditLog);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// API Routes
app.use('/api/carts', cartsRouter);
app.use('/api/carts', checkinsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/files', filesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/protocols', reportsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
