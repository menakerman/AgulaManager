import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';
import { alertService } from '../services/alertService';
import type { CreateDiveRequest, Dive } from '../../../shared/types';
import { DEFAULT_DIVE_SETTINGS } from '../../../shared/types';
import { parseDiveSettings } from '../utils/diveSettings';

const router = Router();

function parseDiveRow(row: any): Dive {
  return {
    ...row,
    team_members: JSON.parse(row.team_members || '[]'),
    settings: parseDiveSettings(row.settings),
  };
}

// GET /api/dives/active - Get current active dive
router.get('/active', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
    if (!row) {
      res.status(404).json({ error: 'No active dive' });
      return;
    }
    res.json(parseDiveRow(row));
  } catch (err) {
    console.error('Error fetching active dive:', err);
    res.status(500).json({ error: 'Failed to fetch active dive' });
  }
});

// POST /api/dives - Start a new dive
router.post('/', (req: Request, res: Response) => {
  try {
    const { manager_name, team_members = [], name, settings } = req.body as CreateDiveRequest;

    if (!manager_name || !manager_name.trim()) {
      res.status(400).json({ error: 'manager_name is required' });
      return;
    }

    const db = getDatabase();

    // Check for already-active dive
    const existing = db.prepare("SELECT id FROM dives WHERE status = 'active'").get();
    if (existing) {
      res.status(409).json({ error: 'A dive is already active' });
      return;
    }

    const now = new Date().toISOString();

    // Clean up: end any leftover active carts from previous sessions
    const leftoverCarts = db.prepare(
      "SELECT id FROM carts WHERE status = 'active'"
    ).all() as Array<{ id: number }>;
    for (const cart of leftoverCarts) {
      db.prepare("UPDATE carts SET status = 'completed', ended_at = ? WHERE id = ?")
        .run(now, cart.id);
      db.prepare("UPDATE events SET status = 'resolved', resolved_at = ? WHERE cart_id = ? AND status = 'open'")
        .run(now, cart.id);
      alertService.resetAlerts(cart.id);
    }

    const diveName = name?.trim() || null;
    const mergedSettings = { ...DEFAULT_DIVE_SETTINGS, ...settings };
    const result = db.prepare(
      'INSERT INTO dives (name, manager_name, team_members, settings, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(diveName, manager_name.trim(), JSON.stringify(team_members), JSON.stringify(mergedSettings), now);

    const dive = db.prepare('SELECT * FROM dives WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseDiveRow(dive));
  } catch (err) {
    console.error('Error creating dive:', err);
    res.status(500).json({ error: 'Failed to create dive' });
  }
});

// POST /api/dives/:id/end - End a dive (and all its active carts)
router.post('/:id/end', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const now = new Date().toISOString();

    // End all active carts in this dive
    const activeCarts = db.prepare(
      "SELECT id FROM carts WHERE dive_id = ? AND status = 'active'"
    ).all(id) as Array<{ id: number }>;

    for (const cart of activeCarts) {
      db.prepare("UPDATE carts SET status = 'completed', ended_at = ? WHERE id = ?")
        .run(now, cart.id);
      db.prepare("UPDATE events SET status = 'resolved', resolved_at = ? WHERE cart_id = ? AND status = 'open'")
        .run(now, cart.id);
      alertService.resetAlerts(cart.id);
    }

    // End the dive
    db.prepare("UPDATE dives SET status = 'completed', ended_at = ? WHERE id = ?")
      .run(now, id);

    const dive = db.prepare('SELECT * FROM dives WHERE id = ?').get(id);

    // Notify clients about ended carts
    const io = req.app.get('io');
    if (io) {
      for (const cart of activeCarts) {
        const endedCart = db.prepare('SELECT * FROM carts WHERE id = ?').get(cart.id) as any;
        if (endedCart) {
          endedCart.diver_names = JSON.parse(endedCart.diver_names);
          io.emit('cart:ended', endedCart);
        }
      }
    }

    res.json(parseDiveRow(dive));
  } catch (err) {
    console.error('Error ending dive:', err);
    res.status(500).json({ error: 'Failed to end dive' });
  }
});

// PUT /api/dives/:id - Update dive details
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { manager_name, team_members, name, settings } = req.body as Partial<CreateDiveRequest>;
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];

    if (manager_name !== undefined) {
      updates.push('manager_name = ?');
      values.push(manager_name.trim());
    }
    if (team_members !== undefined) {
      updates.push('team_members = ?');
      values.push(JSON.stringify(team_members));
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim() || null);
    }
    if (settings !== undefined) {
      // Check if settings are locked (any cart in this dive has a checkin)
      const hasCheckin = db.prepare(
        "SELECT 1 FROM checkins c JOIN carts ca ON c.cart_id = ca.id WHERE ca.dive_id = ? LIMIT 1"
      ).get(id);
      if (hasCheckin) {
        res.status(409).json({ error: 'Settings are locked after timers have started' });
        return;
      }
      const existing = parseDiveSettings(
        (db.prepare('SELECT settings FROM dives WHERE id = ?').get(id) as any)?.settings
      );
      const merged = { ...existing, ...settings };
      updates.push('settings = ?');
      values.push(JSON.stringify(merged));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE dives SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const dive = db.prepare('SELECT * FROM dives WHERE id = ?').get(id);
    res.json(parseDiveRow(dive));
  } catch (err) {
    console.error('Error updating dive:', err);
    res.status(500).json({ error: 'Failed to update dive' });
  }
});

// GET /api/dives/:id/settings-locked - Check if dive settings are locked
router.get('/:id/settings-locked', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const hasCheckin = db.prepare(
      "SELECT 1 FROM checkins c JOIN carts ca ON c.cart_id = ca.id WHERE ca.dive_id = ? LIMIT 1"
    ).get(id);
    res.json({ locked: !!hasCheckin });
  } catch (err) {
    console.error('Error checking settings lock:', err);
    res.status(500).json({ error: 'Failed to check settings lock' });
  }
});

export default router;
