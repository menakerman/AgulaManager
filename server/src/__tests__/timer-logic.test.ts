import { describe, it, expect } from 'vitest';
import { getDatabase } from '../db/database';
import { timerService } from '../services/timerService';

/** Helper: insert a dive and return its id */
function createDive(name = 'Mgr'): number {
  const db = getDatabase();
  const result = db.prepare(
    "INSERT INTO dives (manager_name, team_members, started_at) VALUES (?, '[]', ?)"
  ).run(name, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

/** Helper: insert an active cart and return its id */
function createCart(diveId: number, cartNumber = 1): number {
  const db = getDatabase();
  const result = db.prepare(
    "INSERT INTO carts (cart_number, diver_names, started_at, dive_id) VALUES (?, '[\"A\",\"B\"]', ?, ?)"
  ).run(cartNumber, new Date().toISOString(), diveId);
  return Number(result.lastInsertRowid);
}

/** Helper: insert a checkin with a given deadline */
function addCheckin(cartId: number, deadline: Date): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO checkins (cart_id, checked_in_at, next_deadline) VALUES (?, ?, ?)'
  ).run(cartId, new Date().toISOString(), deadline.toISOString());
}

describe('Timer Logic — getActiveCartsWithTimers()', () => {
  it('No checkin + no paused_at → waiting', () => {
    const diveId = createDive();
    createCart(diveId);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts).toHaveLength(1);
    expect(carts[0].timer_status).toBe('waiting');
  });

  it('paused_at set → paused', () => {
    const diveId = createDive();
    const cartId = createCart(diveId);

    const db = getDatabase();
    db.prepare('UPDATE carts SET paused_at = ? WHERE id = ?').run(new Date().toISOString(), cartId);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts[0].timer_status).toBe('paused');
  });

  it('Deadline >10min away → green', () => {
    const diveId = createDive();
    const cartId = createCart(diveId);

    // Deadline 30 minutes from now
    const deadline = new Date(Date.now() + 30 * 60 * 1000);
    addCheckin(cartId, deadline);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts[0].timer_status).toBe('green');
    expect(carts[0].seconds_remaining).toBeGreaterThan(10 * 60);
  });

  it('Deadline 5min away → orange', () => {
    const diveId = createDive();
    const cartId = createCart(diveId);

    // Deadline 5 minutes from now
    const deadline = new Date(Date.now() + 5 * 60 * 1000);
    addCheckin(cartId, deadline);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts[0].timer_status).toBe('orange');
  });

  it('Deadline in the past → expired, seconds_remaining=0', () => {
    const diveId = createDive();
    const cartId = createCart(diveId);

    // Deadline 5 minutes ago
    const deadline = new Date(Date.now() - 5 * 60 * 1000);
    addCheckin(cartId, deadline);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts[0].timer_status).toBe('expired');
    expect(carts[0].seconds_remaining).toBe(0);
  });

  it('Boundary: exactly 10min → orange', () => {
    const diveId = createDive();
    const cartId = createCart(diveId);

    // Deadline exactly 10 minutes from now (600 seconds)
    const deadline = new Date(Date.now() + 10 * 60 * 1000);
    addCheckin(cartId, deadline);

    const carts = timerService.getActiveCartsWithTimers();
    // At exactly 600 seconds, secondsRemaining <= WARNING_THRESHOLD*60 → orange
    expect(carts[0].timer_status).toBe('orange');
  });

  it('Only returns carts from active dive', () => {
    const db = getDatabase();

    // First dive (completed)
    const dive1 = createDive('Old');
    createCart(dive1, 1);
    db.prepare("UPDATE dives SET status = 'completed' WHERE id = ?").run(dive1);

    // Second dive (active)
    const dive2 = createDive('Current');
    createCart(dive2, 2);

    const carts = timerService.getActiveCartsWithTimers();
    expect(carts).toHaveLength(1);
    expect(carts[0].cart_number).toBe(2);
  });
});
