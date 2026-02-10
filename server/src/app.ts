import express from 'express';
import cors from 'cors';

import { auditLog } from './middleware/auditLog';

import cartsRouter from './routes/carts';
import checkinsRouter from './routes/checkins';
import eventsRouter from './routes/events';
import filesRouter from './routes/files';
import reportsRouter from './routes/reports';
import divesRouter from './routes/dives';

export function createApp() {
  const app = express();

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

  // Middleware
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.use(auditLog);

  // API Routes
  app.use('/api/dives', divesRouter);
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

  return app;
}
