import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';
import type { CreateEventRequest, UpdateEventRequest } from '../../../shared/types';

const router = Router();

// GET /api/events - List emergency events
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const status = req.query.status as string | undefined;

    let query = 'SELECT * FROM events';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY opened_at DESC';

    const events = db.prepare(query).all(...params).map((e: any) => ({
      ...e,
      notes: e.notes ? JSON.parse(e.notes) : [],
    }));

    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/events - Create event
router.post('/', (req: Request, res: Response) => {
  try {
    const { cart_id, event_type, notes } = req.body as CreateEventRequest;

    if (!cart_id || !event_type) {
      res.status(400).json({ error: 'cart_id and event_type are required' });
      return;
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const notesArr = notes ? JSON.stringify([notes]) : JSON.stringify([]);

    const result = db.prepare(
      'INSERT INTO events (cart_id, event_type, opened_at, notes) VALUES (?, ?, ?, ?)'
    ).run(cart_id, event_type, now, notesArr);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid) as any;
    event.notes = JSON.parse(event.notes || '[]');

    const io = req.app.get('io');
    if (io) {
      io.emit('event:created', event);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update/resolve event
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, resolved_at } = req.body as UpdateEventRequest;
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'resolved' && !resolved_at) {
        updates.push('resolved_at = ?');
        values.push(new Date().toISOString());
      }
    }
    if (resolved_at !== undefined) {
      updates.push('resolved_at = ?');
      values.push(resolved_at);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(JSON.stringify(notes));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
    event.notes = JSON.parse(event.notes || '[]');

    const io = req.app.get('io');
    if (io) {
      io.emit('event:updated', event);
    }

    res.json(event);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
