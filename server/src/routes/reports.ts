import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';
import type { DiveReportSummary, DiveReportDetail } from '../../../shared/types';
import { parseDiveSettings } from '../utils/diveSettings';

const router = Router();

// GET /api/reports/dives - List all dives with summary stats
router.get('/dives', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const dives = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM carts WHERE dive_id = d.id) as cart_count,
        (SELECT COUNT(*) FROM checkins ch JOIN carts c ON ch.cart_id = c.id WHERE c.dive_id = d.id) as checkin_count,
        (SELECT COUNT(*) FROM events e JOIN carts c ON e.cart_id = c.id WHERE c.dive_id = d.id) as event_count
      FROM dives d
      ORDER BY d.started_at DESC
    `).all() as any[];

    const reports: DiveReportSummary[] = dives.map((d) => ({
      dive: {
        id: d.id,
        name: d.name || undefined,
        manager_name: d.manager_name,
        team_members: JSON.parse(d.team_members || '[]'),
        settings: parseDiveSettings(d.settings),
        status: d.status,
        started_at: d.started_at,
        ended_at: d.ended_at,
        created_at: d.created_at,
      },
      cart_count: d.cart_count,
      checkin_count: d.checkin_count,
      event_count: d.event_count,
      duration_minutes: d.ended_at
        ? Math.round((new Date(d.ended_at).getTime() - new Date(d.started_at).getTime()) / 60000)
        : null,
    }));

    res.json(reports);
  } catch (err) {
    console.error('Error fetching dive reports:', err);
    res.status(500).json({ error: 'Failed to fetch dive reports' });
  }
});

// GET /api/reports/dives/:id - Full dive report detail
router.get('/dives/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const diveId = Number(req.params.id);

    const diveRow = db.prepare('SELECT * FROM dives WHERE id = ?').get(diveId) as any;
    if (!diveRow) {
      res.status(404).json({ error: 'Dive not found' });
      return;
    }

    const dive = {
      id: diveRow.id,
      name: diveRow.name || undefined,
      manager_name: diveRow.manager_name,
      team_members: JSON.parse(diveRow.team_members || '[]'),
      settings: parseDiveSettings(diveRow.settings),
      status: diveRow.status,
      started_at: diveRow.started_at,
      ended_at: diveRow.ended_at,
      created_at: diveRow.created_at,
    };

    // Carts with checkin/event counts
    const cartsRaw = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM checkins WHERE cart_id = c.id) as checkin_count,
        (SELECT COUNT(*) FROM events WHERE cart_id = c.id) as event_count,
        (SELECT checked_in_at FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as last_checkin
      FROM carts c
      WHERE c.dive_id = ?
      ORDER BY c.cart_number
    `).all(diveId) as any[];

    const carts = cartsRaw.map((c) => ({
      id: c.id,
      cart_number: c.cart_number,
      cart_type: c.cart_type,
      diver_names: JSON.parse(c.diver_names),
      status: c.status,
      started_at: c.started_at,
      ended_at: c.ended_at,
      checkin_count: c.checkin_count,
      event_count: c.event_count,
      last_checkin: c.last_checkin,
    }));

    // Events with cart_number joined
    const eventsRaw = db.prepare(`
      SELECT e.*, c.cart_number
      FROM events e
      JOIN carts c ON e.cart_id = c.id
      WHERE c.dive_id = ?
      ORDER BY e.opened_at DESC
    `).all(diveId) as any[];

    const events = eventsRaw.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      status: e.status,
      cart_number: e.cart_number,
      opened_at: e.opened_at,
      resolved_at: e.resolved_at,
      notes: e.notes ? JSON.parse(e.notes) : [],
    }));

    // Events by type
    const eventsByType = eventsRaw.reduce((acc: Record<string, number>, e: any) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {});

    // Total checkin count
    const checkinCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM checkins ch
      JOIN carts c ON ch.cart_id = c.id
      WHERE c.dive_id = ?
    `).get(diveId) as { count: number };

    // Build timeline from structured tables
    const timeline: Array<{ timestamp: string; type: string; description: string }> = [];

    // Dive started
    timeline.push({
      timestamp: dive.started_at,
      type: 'dive_start',
      description: `צלילה התחילה — מנהל: ${dive.manager_name}`,
    });

    // Cart created
    for (const c of cartsRaw) {
      const divers = JSON.parse(c.diver_names);
      timeline.push({
        timestamp: c.started_at,
        type: 'cart_start',
        description: `עגלה ${c.cart_number} נוספה — ${divers.join(', ')}`,
      });
    }

    // Checkins
    const checkinsRaw = db.prepare(`
      SELECT ch.*, c.cart_number
      FROM checkins ch
      JOIN carts c ON ch.cart_id = c.id
      WHERE c.dive_id = ?
      ORDER BY ch.checked_in_at
    `).all(diveId) as any[];

    for (const ch of checkinsRaw) {
      const desc = ch.reset_reason
        ? `עגלה ${ch.cart_number} — איפוס טיימר: ${ch.reset_reason}`
        : ch.location
          ? `עגלה ${ch.cart_number} — הזדהות (${ch.location})`
          : `עגלה ${ch.cart_number} — הזדהות`;
      timeline.push({
        timestamp: ch.checked_in_at,
        type: 'checkin',
        description: desc,
      });
    }

    // Events opened/resolved
    for (const e of eventsRaw) {
      const typeLabel = e.event_type === 'emergency' ? 'חירום' : e.event_type === 'overdue' ? 'חריגה' : 'אזהרה';
      timeline.push({
        timestamp: e.opened_at,
        type: 'event_open',
        description: `אירוע ${typeLabel} נפתח — עגלה ${e.cart_number}`,
      });
      if (e.resolved_at) {
        timeline.push({
          timestamp: e.resolved_at,
          type: 'event_resolve',
          description: `אירוע ${typeLabel} נסגר — עגלה ${e.cart_number}`,
        });
      }
    }

    // Cart ended
    for (const c of cartsRaw) {
      if (c.ended_at) {
        timeline.push({
          timestamp: c.ended_at,
          type: 'cart_end',
          description: `עגלה ${c.cart_number} סיימה`,
        });
      }
    }

    // Dive ended
    if (dive.ended_at) {
      timeline.push({
        timestamp: dive.ended_at,
        type: 'dive_end',
        description: 'צלילה הסתיימה',
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const durationMinutes = dive.ended_at
      ? Math.round((new Date(dive.ended_at).getTime() - new Date(dive.started_at).getTime()) / 60000)
      : null;

    const report: DiveReportDetail = {
      dive,
      summary: {
        cart_count: carts.length,
        checkin_count: checkinCountRow.count,
        event_count: events.length,
        events_by_type: eventsByType,
        duration_minutes: durationMinutes,
      },
      carts,
      events,
      timeline,
    };

    res.json(report);
  } catch (err) {
    console.error('Error fetching dive report detail:', err);
    res.status(500).json({ error: 'Failed to fetch dive report' });
  }
});

// GET /api/reports/dives/:id/export - Export dive report as CSV
router.get('/dives/:id/export', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const diveId = Number(req.params.id);

    const diveRow = db.prepare('SELECT * FROM dives WHERE id = ?').get(diveId) as any;
    if (!diveRow) {
      res.status(404).json({ error: 'Dive not found' });
      return;
    }

    const diveName = diveRow.name || `צלילה ${new Date(diveRow.started_at).toLocaleDateString('he-IL')}`;

    const cartsRaw = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM checkins WHERE cart_id = c.id) as checkin_count,
        (SELECT COUNT(*) FROM events WHERE cart_id = c.id) as event_count,
        (SELECT checked_in_at FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as last_checkin
      FROM carts c
      WHERE c.dive_id = ?
      ORDER BY c.cart_number
    `).all(diveId) as any[];

    const eventsRaw = db.prepare(`
      SELECT e.*, c.cart_number
      FROM events e
      JOIN carts c ON e.cart_id = c.id
      WHERE c.dive_id = ?
      ORDER BY e.opened_at DESC
    `).all(diveId) as any[];

    const lines: string[] = [];

    // Dive info section
    lines.push('פרטי צלילה');
    lines.push(`שם,${diveName}`);
    lines.push(`מנהל,${diveRow.manager_name}`);
    lines.push(`סטטוס,${diveRow.status === 'active' ? 'פעילה' : 'הושלמה'}`);
    lines.push(`התחלה,${diveRow.started_at}`);
    lines.push(`סיום,${diveRow.ended_at || 'טרם הסתיימה'}`);
    lines.push('');

    // Carts section
    lines.push('עגלות');
    lines.push('מספר עגלה,סוג,צוללנים,סטטוס,התחלה,סיום,הזדהויות,אירועים,הזדהות אחרונה');
    for (const c of cartsRaw) {
      const divers = JSON.parse(c.diver_names);
      lines.push([
        c.cart_number,
        c.cart_type,
        `"${divers.join(', ')}"`,
        c.status === 'active' ? 'פעיל' : 'הושלם',
        c.started_at,
        c.ended_at || '',
        c.checkin_count,
        c.event_count,
        c.last_checkin || '',
      ].join(','));
    }
    lines.push('');

    // Events section
    lines.push('אירועים');
    lines.push('סוג,סטטוס,עגלה,נפתח,נסגר');
    for (const e of eventsRaw) {
      const typeLabel = e.event_type === 'emergency' ? 'חירום' : e.event_type === 'overdue' ? 'חריגה' : 'אזהרה';
      lines.push([
        typeLabel,
        e.status === 'open' ? 'פתוח' : 'נסגר',
        e.cart_number,
        e.opened_at,
        e.resolved_at || '',
      ].join(','));
    }

    const csvContent = '\ufeff' + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dive-report-${diveId}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting dive report:', err);
    res.status(500).json({ error: 'Failed to export dive report' });
  }
});

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
