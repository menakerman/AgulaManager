import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';

const router = Router();

// GET /api/reports/daily - Daily summary report
router.get('/daily', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const totalCarts = db.prepare(
      `SELECT COUNT(*) as count FROM carts WHERE date(started_at) = ?`
    ).get(date) as { count: number };

    const activeCarts = db.prepare(
      `SELECT COUNT(*) as count FROM carts WHERE status = 'active' AND date(started_at) = ?`
    ).get(date) as { count: number };

    const completedCarts = db.prepare(
      `SELECT COUNT(*) as count FROM carts WHERE status = 'completed' AND date(started_at) = ?`
    ).get(date) as { count: number };

    const totalCheckins = db.prepare(
      `SELECT COUNT(*) as count FROM checkins WHERE date(checked_in_at) = ?`
    ).get(date) as { count: number };

    const events = db.prepare(
      `SELECT event_type, COUNT(*) as count FROM events WHERE date(opened_at) = ? GROUP BY event_type`
    ).all(date) as Array<{ event_type: string; count: number }>;

    const openEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE status = 'open'`
    ).get() as { count: number };

    const cartsData = db.prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM checkins WHERE cart_id = c.id AND date(checked_in_at) = ?) as checkin_count
       FROM carts c WHERE date(c.started_at) = ?
       ORDER BY c.cart_number`
    ).all(date, date).map((c: any) => ({
      ...c,
      diver_names: JSON.parse(c.diver_names),
    }));

    res.json({
      date,
      summary: {
        total_carts: totalCarts.count,
        active_carts: activeCarts.count,
        completed_carts: completedCarts.count,
        total_checkins: totalCheckins.count,
        open_events: openEvents.count,
        events_by_type: events.reduce((acc, e) => {
          acc[e.event_type] = e.count;
          return acc;
        }, {} as Record<string, number>),
      },
      carts: cartsData,
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/export - Export data
router.get('/export', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const format = req.query.format as string || 'json';
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const carts = db.prepare(
      `SELECT c.*,
        (SELECT checked_in_at FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as last_checkin,
        (SELECT COUNT(*) FROM checkins WHERE cart_id = c.id) as total_checkins
       FROM carts c WHERE date(c.started_at) = ?
       ORDER BY c.cart_number`
    ).all(date).map((c: any) => ({
      ...c,
      diver_names: JSON.parse(c.diver_names),
    }));

    const checkins = db.prepare(
      `SELECT ch.*, c.cart_number
       FROM checkins ch
       JOIN carts c ON ch.cart_id = c.id
       WHERE date(ch.checked_in_at) = ?
       ORDER BY ch.checked_in_at DESC`
    ).all(date);

    const events = db.prepare(
      `SELECT e.*, c.cart_number
       FROM events e
       JOIN carts c ON e.cart_id = c.id
       WHERE date(e.opened_at) = ?
       ORDER BY e.opened_at DESC`
    ).all(date).map((e: any) => ({
      ...e,
      notes: e.notes ? JSON.parse(e.notes) : [],
    }));

    if (format === 'csv') {
      const csvLines = ['Cart Number,Type,Divers,Status,Started,Ended,Total Check-ins,Last Check-in'];
      for (const cart of carts) {
        csvLines.push([
          cart.cart_number,
          cart.cart_type,
          `"${(cart.diver_names as string[]).join(', ')}"`,
          cart.status,
          cart.started_at,
          cart.ended_at || '',
          (cart as any).total_checkins,
          (cart as any).last_checkin || '',
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=agula-report-${date}.csv`);
      res.send(csvLines.join('\n'));
      return;
    }

    res.json({ date, carts, checkins, events });
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// GET /api/protocols - List emergency protocols
router.get('/protocols', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const protocols = db.prepare('SELECT * FROM protocols ORDER BY id').all();
    res.json(protocols);
  } catch (err) {
    console.error('Error fetching protocols:', err);
    res.status(500).json({ error: 'Failed to fetch protocols' });
  }
});

// POST /api/protocols - Create protocol
router.post('/protocols', (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'title and content are required' });
      return;
    }

    const db = getDatabase();
    const result = db.prepare(
      'INSERT INTO protocols (title, content) VALUES (?, ?)'
    ).run(title, content);

    const protocol = db.prepare('SELECT * FROM protocols WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(protocol);
  } catch (err) {
    console.error('Error creating protocol:', err);
    res.status(500).json({ error: 'Failed to create protocol' });
  }
});

export default router;
