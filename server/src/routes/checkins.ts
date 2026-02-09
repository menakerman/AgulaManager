import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database';
import { timerService } from '../services/timerService';
import { alertService } from '../services/alertService';
import { CHECKIN_INTERVAL_MINUTES, roundToNearest5Minutes } from '../../../shared/types';
import type { CheckInRequest, ResetTimerRequest } from '../../../shared/types';

const router = Router();

// POST /api/carts/:id/checkin - Record identification (הזדהות) and PAUSE the timer
router.post('/:id/checkin', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { location } = req.body as CheckInRequest;
    const db = getDatabase();

    // Verify cart exists and is active
    const cart = db.prepare('SELECT * FROM carts WHERE id = ? AND status = ?').get(id, 'active') as any;
    if (!cart) {
      res.status(404).json({ error: 'Active cart not found' });
      return;
    }

    const now = new Date().toISOString();

    // Pause the cart - set paused_at
    db.prepare('UPDATE carts SET paused_at = ? WHERE id = ?').run(now, id);

    // Reset alerts for this cart
    alertService.resetAlerts(Number(id));

    // Resolve any open events for this cart
    db.prepare(
      'UPDATE events SET status = ?, resolved_at = ? WHERE cart_id = ? AND status = ?'
    ).run('resolved', now, id, 'open');

    const updatedCart = timerService.getCartWithTimer(Number(id));

    const io = req.app.get('io');
    if (io && updatedCart) {
      io.emit('checkin:recorded', { cart: updatedCart, checkin: null });
    }

    res.json({ cart: updatedCart, checkin: null });
  } catch (err) {
    console.error('Error recording identification:', err);
    res.status(500).json({ error: 'Failed to record identification' });
  }
});

// POST /api/carts/:id/newround - Start new round (עגולה חדשה) with 5-min rounded deadline
router.post('/:id/newround', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { location } = req.body as CheckInRequest;
    const db = getDatabase();

    const cart = db.prepare('SELECT * FROM carts WHERE id = ? AND status = ?').get(id, 'active') as any;
    if (!cart) {
      res.status(404).json({ error: 'Active cart not found' });
      return;
    }

    const now = new Date();
    const rawDeadline = new Date(now.getTime() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);
    const deadline = roundToNearest5Minutes(rawDeadline);

    // Record the check-in with rounded deadline
    db.prepare(
      'INSERT INTO checkins (cart_id, checked_in_at, next_deadline, location) VALUES (?, ?, ?, ?)'
    ).run(id, now.toISOString(), deadline.toISOString(), location || null);

    // Unpause the cart
    db.prepare('UPDATE carts SET paused_at = NULL WHERE id = ?').run(id);

    alertService.resetAlerts(Number(id));

    const updatedCart = timerService.getCartWithTimer(Number(id));
    const checkin = db.prepare(
      'SELECT * FROM checkins WHERE cart_id = ? ORDER BY checked_in_at DESC LIMIT 1'
    ).get(id);

    const io = req.app.get('io');
    if (io && updatedCart) {
      io.emit('checkin:recorded', { cart: updatedCart, checkin });
    }

    res.json({ cart: updatedCart, checkin });
  } catch (err) {
    console.error('Error starting new round:', err);
    res.status(500).json({ error: 'Failed to start new round' });
  }
});

// POST /api/carts/:id/reset - Reset timer with reason
router.post('/:id/reset', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as ResetTimerRequest;

    if (!reason) {
      res.status(400).json({ error: 'Reason is required for timer reset' });
      return;
    }

    const db = getDatabase();
    const cart = db.prepare('SELECT * FROM carts WHERE id = ? AND status = ?').get(id, 'active');
    if (!cart) {
      res.status(404).json({ error: 'Active cart not found' });
      return;
    }

    const now = new Date();
    const rawDeadline = new Date(now.getTime() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);
    const deadline = roundToNearest5Minutes(rawDeadline);

    db.prepare(
      'INSERT INTO checkins (cart_id, checked_in_at, next_deadline, reset_reason) VALUES (?, ?, ?, ?)'
    ).run(id, now.toISOString(), deadline.toISOString(), reason);

    // Unpause if paused
    db.prepare('UPDATE carts SET paused_at = NULL WHERE id = ?').run(id);

    alertService.resetAlerts(Number(id));

    // Resolve any open events
    db.prepare(
      'UPDATE events SET status = ?, resolved_at = ? WHERE cart_id = ? AND status = ?'
    ).run('resolved', now.toISOString(), id, 'open');

    const updatedCart = timerService.getCartWithTimer(Number(id));

    const io = req.app.get('io');
    if (io && updatedCart) {
      io.emit('checkin:recorded', { cart: updatedCart, checkin: null });
    }

    res.json(updatedCart);
  } catch (err) {
    console.error('Error resetting timer:', err);
    res.status(500).json({ error: 'Failed to reset timer' });
  }
});

// GET /api/carts/:id/history - Identification history
router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const checkins = db.prepare(
      'SELECT * FROM checkins WHERE cart_id = ? ORDER BY checked_in_at DESC'
    ).all(id);

    res.json(checkins);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
