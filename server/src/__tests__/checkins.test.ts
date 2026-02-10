import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getDatabase } from '../db/database';

function app() {
  const a = createApp();
  a.set('io', { emit: () => {} });
  return a;
}

/** Helper: create dive + cart, return app and cartId */
async function withCart(startTimer = false) {
  const a = app();
  await request(a).post('/api/dives').send({ manager_name: 'Mgr' });
  const cartRes = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A', 'B'] });
  const cartId = cartRes.body.id as number;

  if (startTimer) {
    await request(a).post('/api/carts/start-timers').send({ cart_ids: [cartId] });
  }

  return { app: a, cartId };
}

describe('Checkins API', () => {
  it('POST /:id/checkin — pauses the cart', async () => {
    const { app: a, cartId } = await withCart(true);

    const res = await request(a).post(`/api/carts/${cartId}/checkin`).send({});
    expect(res.status).toBe(200);
    expect(res.body.cart.timer_status).toBe('paused');
    expect(res.body.cart.paused_at).toBeTruthy();
  });

  it('POST /:id/checkin — 404 for non-existent cart', async () => {
    const a = app();
    await request(a).post('/api/dives').send({ manager_name: 'Mgr' });

    const res = await request(a).post('/api/carts/99999/checkin').send({});
    expect(res.status).toBe(404);
  });

  it('POST /:id/checkin — updates location if provided', async () => {
    const { app: a, cartId } = await withCart(true);

    await request(a).post(`/api/carts/${cartId}/checkin`).send({ location: 'South wall' });

    const db = getDatabase();
    const cart = db.prepare('SELECT checkin_location FROM carts WHERE id = ?').get(cartId) as any;
    expect(cart.checkin_location).toBe('South wall');
  });

  it('POST /:id/checkin — resolves open events', async () => {
    const { app: a, cartId } = await withCart(true);

    // Manually insert an open event
    const db = getDatabase();
    db.prepare("INSERT INTO events (cart_id, event_type, opened_at, status) VALUES (?, 'warning', ?, 'open')")
      .run(cartId, new Date().toISOString());

    await request(a).post(`/api/carts/${cartId}/checkin`).send({});

    const event = db.prepare('SELECT status FROM events WHERE cart_id = ?').get(cartId) as any;
    expect(event.status).toBe('resolved');
  });

  it('POST /:id/newround — creates checkin with correct deadline (~60min, rounded to 5min)', async () => {
    const { app: a, cartId } = await withCart(true);

    // First pause
    await request(a).post(`/api/carts/${cartId}/checkin`).send({});

    // Start new round
    const res = await request(a).post(`/api/carts/${cartId}/newround`).send({});
    expect(res.status).toBe(200);
    expect(res.body.checkin).toBeTruthy();

    const deadline = new Date(res.body.checkin.next_deadline);
    expect(deadline.getMinutes() % 5).toBe(0);
    expect(deadline.getSeconds()).toBe(0);

    // Should be roughly 60 min from now
    const diff = deadline.getTime() - Date.now();
    expect(diff).toBeGreaterThan(55 * 60 * 1000);
    expect(diff).toBeLessThan(65 * 60 * 1000);
  });

  it('POST /:id/newround — clears paused_at', async () => {
    const { app: a, cartId } = await withCart(true);

    // Pause
    await request(a).post(`/api/carts/${cartId}/checkin`).send({});

    // New round
    const res = await request(a).post(`/api/carts/${cartId}/newround`).send({});
    expect(res.body.cart.paused_at).toBeNull();
    expect(res.body.cart.timer_status).not.toBe('paused');
  });

  it('POST /:id/newround — records location', async () => {
    const { app: a, cartId } = await withCart(true);

    await request(a).post(`/api/carts/${cartId}/checkin`).send({});
    await request(a).post(`/api/carts/${cartId}/newround`).send({ location: 'East cave' });

    const db = getDatabase();
    const checkin = db.prepare('SELECT location FROM checkins WHERE cart_id = ? ORDER BY checked_in_at DESC LIMIT 1').get(cartId) as any;
    expect(checkin.location).toBe('East cave');
  });

  it('POST /:id/reset — resets timer with reason stored', async () => {
    const { app: a, cartId } = await withCart(true);

    const res = await request(a)
      .post(`/api/carts/${cartId}/reset`)
      .send({ reason: 'Equipment issue' });

    expect(res.status).toBe(200);

    const db = getDatabase();
    const checkin = db.prepare('SELECT reset_reason FROM checkins WHERE cart_id = ? ORDER BY checked_in_at DESC LIMIT 1').get(cartId) as any;
    expect(checkin.reset_reason).toBe('Equipment issue');
  });

  it('POST /:id/reset — 400 when reason missing', async () => {
    const { app: a, cartId } = await withCart(true);

    const res = await request(a)
      .post(`/api/carts/${cartId}/reset`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Reason');
  });

  it('GET /:id/history — returns checkin history', async () => {
    const { app: a, cartId } = await withCart(true);

    // Pause and new round to get two checkins
    await request(a).post(`/api/carts/${cartId}/checkin`).send({});
    await request(a).post(`/api/carts/${cartId}/newround`).send({});

    const res = await request(a).get(`/api/carts/${cartId}/history`);
    expect(res.status).toBe(200);
    // start-timers creates 1 checkin, newround creates another = 2
    expect(res.body.length).toBe(2);
  });
});
