import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getDatabase } from '../db/database';

function app() {
  const a = createApp();
  // No-op io emitter for tests
  a.set('io', { emit: () => {} });
  return a;
}

describe('Dives API', () => {
  it('POST /api/dives — creates dive, returns 201', async () => {
    const res = await request(app())
      .post('/api/dives')
      .send({ manager_name: 'Yoni' });

    expect(res.status).toBe(201);
    expect(res.body.manager_name).toBe('Yoni');
    expect(res.body.status).toBe('active');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/dives — 400 when manager_name missing', async () => {
    const res = await request(app())
      .post('/api/dives')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('manager_name');
  });

  it('POST /api/dives — 409 when dive already active', async () => {
    const a = app();
    await request(a).post('/api/dives').send({ manager_name: 'Yoni' });
    const res = await request(a).post('/api/dives').send({ manager_name: 'Dan' });

    expect(res.status).toBe(409);
  });

  it('POST /api/dives — cleans up leftover active carts', async () => {
    const db = getDatabase();
    // Manually insert a leftover active cart (no dive)
    db.prepare("INSERT INTO carts (cart_number, diver_names, started_at, status) VALUES (1, '[\"A\"]', '2024-01-01T00:00:00Z', 'active')").run();

    const a = app();
    await request(a).post('/api/dives').send({ manager_name: 'Yoni' });

    const cart = db.prepare('SELECT status FROM carts WHERE cart_number = 1').get() as any;
    expect(cart.status).toBe('completed');
  });

  it('GET /api/dives/active — returns active dive', async () => {
    const a = app();
    await request(a).post('/api/dives').send({ manager_name: 'Yoni' });
    const res = await request(a).get('/api/dives/active');

    expect(res.status).toBe(200);
    expect(res.body.manager_name).toBe('Yoni');
    expect(res.body.status).toBe('active');
  });

  it('GET /api/dives/active — 404 when none active', async () => {
    const res = await request(app()).get('/api/dives/active');
    expect(res.status).toBe(404);
  });

  it('POST /api/dives/:id/end — ends dive + all its carts', async () => {
    const a = app();
    const diveRes = await request(a).post('/api/dives').send({ manager_name: 'Yoni' });
    const diveId = diveRes.body.id;

    // Create a cart in this dive
    await request(a).post('/api/carts').send({
      cart_number: 1,
      diver_names: ['Alice', 'Bob'],
      dive_id: diveId,
    });

    const endRes = await request(a).post(`/api/dives/${diveId}/end`);
    expect(endRes.status).toBe(200);
    expect(endRes.body.status).toBe('completed');

    // Cart should also be completed
    const db = getDatabase();
    const cart = db.prepare('SELECT status FROM carts WHERE dive_id = ?').get(diveId) as any;
    expect(cart.status).toBe('completed');
  });

  it('PUT /api/dives/:id — updates manager_name and team_members', async () => {
    const a = app();
    const diveRes = await request(a).post('/api/dives').send({ manager_name: 'Yoni' });
    const diveId = diveRes.body.id;

    const updateRes = await request(a)
      .put(`/api/dives/${diveId}`)
      .send({
        manager_name: 'Dan',
        team_members: [{ role: 'חובש', name: 'Eli' }],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.manager_name).toBe('Dan');
    expect(updateRes.body.team_members).toEqual([{ role: 'חובש', name: 'Eli' }]);
  });
});
