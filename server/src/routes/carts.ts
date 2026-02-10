import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';
import { timerService } from '../services/timerService';
import { alertService } from '../services/alertService';
import { CHECKIN_INTERVAL_MINUTES, roundToNearest5Minutes } from '../../../shared/types';
import type { CreateCartRequest, UpdateCartRequest } from '../../../shared/types';

const router = Router();

// GET /api/carts - List all active carts (with timer info)
router.get('/', (_req: Request, res: Response) => {
  try {
    const carts = timerService.getActiveCartsWithTimers();
    res.json(carts);
  } catch (err) {
    console.error('Error fetching carts:', err);
    res.status(500).json({ error: 'Failed to fetch carts' });
  }
});

// POST /api/carts - Create new cart
router.post('/', (req: Request, res: Response) => {
  try {
    const { cart_number, cart_type = 'pair', diver_names, dive_id } = req.body as CreateCartRequest;

    if (!cart_number || !diver_names || !Array.isArray(diver_names) || diver_names.length === 0) {
      res.status(400).json({ error: 'cart_number and diver_names are required' });
      return;
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Auto-fill dive_id from active dive if not provided
    let resolvedDiveId = dive_id ?? null;
    if (!resolvedDiveId) {
      const activeDive = db.prepare("SELECT id FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
      if (activeDive) resolvedDiveId = activeDive.id;
    }

    const stmt = db.prepare(
      'INSERT INTO carts (cart_number, cart_type, diver_names, started_at, dive_id) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(cart_number, cart_type, JSON.stringify(diver_names), now, resolvedDiveId);

    // Create initial check-in with 5-min rounded deadline
    const rawDeadline = new Date(Date.now() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);
    const deadline = roundToNearest5Minutes(rawDeadline).toISOString();
    db.prepare(
      'INSERT INTO checkins (cart_id, checked_in_at, next_deadline) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, now, deadline);

    const cart = timerService.getCartWithTimer(Number(result.lastInsertRowid));

    const io = req.app.get('io');
    if (io && cart) {
      io.emit('cart:created', cart);
    }

    res.status(201).json(cart);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Cart number already exists' });
      return;
    }
    console.error('Error creating cart:', err);
    res.status(500).json({ error: 'Failed to create cart' });
  }
});

// PUT /api/carts/:id - Update cart
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cart_number, cart_type, diver_names } = req.body as UpdateCartRequest;
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];

    if (cart_number !== undefined) {
      updates.push('cart_number = ?');
      values.push(cart_number);
    }
    if (cart_type !== undefined) {
      updates.push('cart_type = ?');
      values.push(cart_type);
    }
    if (diver_names !== undefined) {
      updates.push('diver_names = ?');
      values.push(JSON.stringify(diver_names));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE carts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const cart = timerService.getCartWithTimer(Number(id));
    const io = req.app.get('io');
    if (io && cart) {
      io.emit('cart:updated', cart);
    }

    res.json(cart);
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// DELETE /api/carts/:id - Remove cart
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM checkins WHERE cart_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE cart_id = ?').run(id);
    db.prepare('DELETE FROM attachments WHERE cart_id = ?').run(id);
    db.prepare('DELETE FROM carts WHERE id = ?').run(id);

    alertService.resetAlerts(Number(id));

    const io = req.app.get('io');
    if (io) {
      io.emit('cart:deleted', Number(id));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting cart:', err);
    res.status(500).json({ error: 'Failed to delete cart' });
  }
});

// POST /api/carts/import - Import carts from parsed data
router.post('/import', (req: Request, res: Response) => {
  try {
    const { carts } = req.body as { carts: CreateCartRequest[] };

    if (!carts || !Array.isArray(carts)) {
      res.status(400).json({ error: 'carts array is required' });
      return;
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const rawDeadline = new Date(Date.now() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);
    const deadline = roundToNearest5Minutes(rawDeadline).toISOString();

    // Auto-fill dive_id from active dive
    let resolvedDiveId: number | null = null;
    const activeDive = db.prepare("SELECT id FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    if (activeDive) resolvedDiveId = activeDive.id;

    const insertCart = db.prepare(
      'INSERT INTO carts (cart_number, cart_type, diver_names, started_at, dive_id) VALUES (?, ?, ?, ?, ?)'
    );
    const insertCheckin = db.prepare(
      'INSERT INTO checkins (cart_id, checked_in_at, next_deadline) VALUES (?, ?, ?)'
    );

    const importMany = db.transaction((cartList: CreateCartRequest[]) => {
      const created: number[] = [];
      for (const cart of cartList) {
        try {
          const result = insertCart.run(
            cart.cart_number,
            cart.cart_type || 'pair',
            JSON.stringify(cart.diver_names),
            now,
            resolvedDiveId
          );
          insertCheckin.run(result.lastInsertRowid, now, deadline);
          created.push(Number(result.lastInsertRowid));
        } catch (err) {
          console.warn(`Skipping duplicate cart #${cart.cart_number}`);
        }
      }
      return created;
    });

    const createdIds = importMany(carts);
    const allCarts = timerService.getActiveCartsWithTimers();

    const io = req.app.get('io');
    if (io) {
      for (const cart of allCarts) {
        if (createdIds.includes(cart.id)) {
          io.emit('cart:created', cart);
        }
      }
    }

    res.status(201).json({ imported: createdIds.length, carts: allCarts.filter(c => createdIds.includes(c.id)) });
  } catch (err) {
    console.error('Error importing carts:', err);
    res.status(500).json({ error: 'Failed to import carts' });
  }
});

// POST /api/carts/:id/end - End cart activity
router.post('/:id/end', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare('UPDATE carts SET status = ?, ended_at = ? WHERE id = ?')
      .run('completed', now, id);

    alertService.resetAlerts(Number(id));

    // Resolve any open events
    db.prepare('UPDATE events SET status = ?, resolved_at = ? WHERE cart_id = ? AND status = ?')
      .run('resolved', now, id, 'open');

    const cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(id) as any;
    if (cart) {
      cart.diver_names = JSON.parse(cart.diver_names);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('cart:ended', cart);
    }

    res.json(cart);
  } catch (err) {
    console.error('Error ending cart:', err);
    res.status(500).json({ error: 'Failed to end cart' });
  }
});

export default router;
