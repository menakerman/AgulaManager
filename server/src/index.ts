import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';

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

const io = new SocketServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Store io instance for routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
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
