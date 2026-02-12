import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getDatabase } from '../db/database';

function app() {
  const a = createApp();
  a.set('io', { emit: () => {} });
  return a;
}

/** Helper: create an active dive and return the app + diveId */
async function withDive() {
  const a = app();
  const res = await request(a).post('/api/dives').send({ manager_name: 'Mgr' });
  return { app: a, diveId: res.body.id as number };
}

describe('Carts API', () => {
  it('POST /api/carts — creates cart linked to active dive', async () => {
    const { app: a, diveId } = await withDive();
    const res = await request(a)
      .post('/api/carts')
      .send({ cart_number: 1, diver_names: ['Alice', 'Bob'] });

    expect(res.status).toBe(201);
    expect(res.body.cart_number).toBe(1);
    expect(res.body.dive_id).toBe(diveId);
    expect(res.body.diver_names).toEqual(['Alice', 'Bob']);
    expect(res.body.timer_status).toBe('waiting');
  });

  it('POST /api/carts — 400 for missing fields', async () => {
    const { app: a } = await withDive();
    const res = await request(a).post('/api/carts').send({ cart_number: 1 });
    expect(res.status).toBe(400);
  });

  it('POST /api/carts — 409 for duplicate cart_number in same dive', async () => {
    const { app: a } = await withDive();
    await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    const res = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['B'] });
    expect(res.status).toBe(409);
  });

  it('POST /api/carts — same cart_number allowed in different dives', async () => {
    const a = app();
    // First dive
    const dive1 = await request(a).post('/api/dives').send({ manager_name: 'M1' });
    await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    await request(a).post(`/api/dives/${dive1.body.id}/end`);

    // Second dive
    await request(a).post('/api/dives').send({ manager_name: 'M2' });
    const res = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['B'] });
    expect(res.status).toBe(201);
  });

  it('PUT /api/carts/:id — updates cart fields', async () => {
    const { app: a } = await withDive();
    const created = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    const cartId = created.body.id;

    const res = await request(a)
      .put(`/api/carts/${cartId}`)
      .send({ diver_names: ['X', 'Y'], cart_type: 3 });

    expect(res.status).toBe(200);
    expect(res.body.diver_names).toEqual(['X', 'Y']);
    expect(res.body.cart_type).toBe(3);
  });

  it('DELETE /api/carts/:id — deletes cart and cascading records', async () => {
    const { app: a } = await withDive();
    const created = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    const cartId = created.body.id;

    // Add a checkin so we can verify cascade delete
    const db = getDatabase();
    db.prepare("INSERT INTO checkins (cart_id, checked_in_at, next_deadline) VALUES (?, ?, ?)").run(cartId, new Date().toISOString(), new Date().toISOString());

    const res = await request(a).delete(`/api/carts/${cartId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify cart and checkins are gone
    const cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId);
    expect(cart).toBeUndefined();
    const checkins = db.prepare('SELECT * FROM checkins WHERE cart_id = ?').all(cartId);
    expect(checkins).toHaveLength(0);
  });

  it('POST /api/carts/:id/end — marks cart completed', async () => {
    const { app: a } = await withDive();
    const created = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    const cartId = created.body.id;

    const res = await request(a).post(`/api/carts/${cartId}/end`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('POST /api/carts/import — bulk import, skips duplicates', async () => {
    const { app: a } = await withDive();

    const res = await request(a).post('/api/carts/import').send({
      carts: [
        { cart_number: 1, diver_names: ['A', 'B'] },
        { cart_number: 2, diver_names: ['C', 'D'] },
        { cart_number: 1, diver_names: ['E', 'F'] }, // duplicate
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
  });

  it('POST /api/carts/start-timers — creates initial checkins with rounded deadline', async () => {
    const { app: a } = await withDive();
    const c1 = await request(a).post('/api/carts').send({ cart_number: 1, diver_names: ['A'] });
    const c2 = await request(a).post('/api/carts').send({ cart_number: 2, diver_names: ['B'] });

    const res = await request(a).post('/api/carts/start-timers').send({
      cart_ids: [c1.body.id, c2.body.id],
      location: 'North reef',
    });

    expect(res.status).toBe(200);
    expect(res.body.started).toBe(2);

    // Verify checkins created with deadline ~60min from now, rounded to 5min
    const db = getDatabase();
    const checkins = db.prepare('SELECT * FROM checkins').all() as any[];
    expect(checkins).toHaveLength(2);

    const deadline = new Date(checkins[0].next_deadline);
    expect(deadline.getMinutes() % 5).toBe(0);
    expect(deadline.getSeconds()).toBe(0);

    // Location should be stored
    const cart = db.prepare('SELECT checkin_location FROM carts WHERE id = ?').get(c1.body.id) as any;
    expect(cart.checkin_location).toBe('North reef');
  });
});
