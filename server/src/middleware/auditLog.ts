import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  // Only log mutating requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalSend = res.send;
    res.send = function (body) {
      try {
        const db = getDatabase();
        const stmt = db.prepare(
          'INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)'
        );

        const action = `${req.method} ${req.originalUrl}`;
        const pathParts = req.originalUrl.split('/').filter(Boolean);
        const entityType = pathParts[1] || null; // e.g., 'carts', 'events'
        const entityId = pathParts[2] ? parseInt(pathParts[2]) || null : null;

        const details = JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          body: req.body,
          statusCode: res.statusCode,
        });

        stmt.run(action, entityType, entityId, details);
      } catch (err) {
        console.error('Audit log error:', err);
      }

      return originalSend.call(this, body);
    };
  }

  next();
}
