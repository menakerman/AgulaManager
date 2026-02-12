import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getDatabase } from '../db/database';

function app() {
  const a = createApp();
  a.set('io', { emit: () => {} });
  return a;
}

// Helper: create a dive, carts, checkins, and events for testing
async function seedDiveData(a: ReturnType<typeof app>) {
  // Create and end a dive with carts/checkins/events
  const diveRes = await request(a)
    .post('/api/dives')
    .send({ manager_name: 'Test Manager', team_members: [{ role: 'חובש', name: 'Eli' }], name: 'Test Dive' });
  const diveId = diveRes.body.id;

  // Create 2 carts
  const cart1Res = await request(a)
    .post('/api/carts')
    .send({ cart_number: 1, cart_type: 2, diver_names: ['Alice', 'Bob'], dive_id: diveId });
  const cart1Id = cart1Res.body.id;

  const cart2Res = await request(a)
    .post('/api/carts')
    .send({ cart_number: 2, cart_type: 3, diver_names: ['Charlie', 'Dan', 'Eve'], dive_id: diveId });
  const cart2Id = cart2Res.body.id;

  // Start timers
  await request(a)
    .post('/api/carts/start-timers')
    .send({ cart_ids: [cart1Id, cart2Id] });

  // Check-in cart 1
  await request(a)
    .post(`/api/carts/${cart1Id}/checkin`)
    .send({ location: 'reef' });

  // New round for cart 1
  await request(a)
    .post(`/api/carts/${cart1Id}/newround`)
    .send({});

  // Create an event on cart 2
  const eventRes = await request(a)
    .post('/api/events')
    .send({ cart_id: cart2Id, event_type: 'warning', notes: 'test warning' });
  const eventId = eventRes.body.id;

  // Resolve the event
  await request(a)
    .put(`/api/events/${eventId}`)
    .send({ status: 'resolved' });

  return { diveId, cart1Id, cart2Id, eventId };
}

describe('Dive Reports API', () => {
  describe('GET /api/reports/dives', () => {
    it('returns empty list when no dives', async () => {
      const res = await request(app()).get('/api/reports/dives');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns dive summaries with correct counts', async () => {
      const a = app();
      await seedDiveData(a);

      const res = await request(a).get('/api/reports/dives');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);

      const report = res.body[0];
      expect(report.dive.manager_name).toBe('Test Manager');
      expect(report.dive.name).toBe('Test Dive');
      expect(report.dive.status).toBe('active');
      expect(report.cart_count).toBe(2);
      expect(report.checkin_count).toBeGreaterThanOrEqual(2); // start-timers + checkin + newround
      expect(report.event_count).toBe(1);
      expect(report.duration_minutes).toBeNull(); // still active
    });

    it('returns completed dive with duration', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);

      // End the dive
      await request(a).post(`/api/dives/${diveId}/end`);

      const res = await request(a).get('/api/reports/dives');
      const report = res.body[0];
      expect(report.dive.status).toBe('completed');
      expect(report.duration_minutes).not.toBeNull();
      expect(typeof report.duration_minutes).toBe('number');
    });

    it('returns dives ordered by started_at DESC', async () => {
      const a = app();
      const db = getDatabase();

      // Insert two dives with known timestamps
      db.prepare("INSERT INTO dives (manager_name, status, started_at, team_members) VALUES ('First', 'completed', '2024-01-01T10:00:00Z', '[]')").run();
      db.prepare("INSERT INTO dives (manager_name, status, started_at, team_members) VALUES ('Second', 'completed', '2024-01-02T10:00:00Z', '[]')").run();

      const res = await request(a).get('/api/reports/dives');
      expect(res.body).toHaveLength(2);
      expect(res.body[0].dive.manager_name).toBe('Second');
      expect(res.body[1].dive.manager_name).toBe('First');
    });
  });

  describe('GET /api/reports/dives/:id', () => {
    it('returns 404 for non-existent dive', async () => {
      const res = await request(app()).get('/api/reports/dives/9999');
      expect(res.status).toBe(404);
    });

    it('returns full dive detail with carts, events, and timeline', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);

      const res = await request(a).get(`/api/reports/dives/${diveId}`);
      expect(res.status).toBe(200);

      const detail = res.body;

      // Dive info
      expect(detail.dive.id).toBe(diveId);
      expect(detail.dive.manager_name).toBe('Test Manager');
      expect(detail.dive.team_members).toEqual([{ role: 'חובש', name: 'Eli' }]);

      // Summary
      expect(detail.summary.cart_count).toBe(2);
      expect(detail.summary.checkin_count).toBeGreaterThanOrEqual(2);
      expect(detail.summary.event_count).toBe(1);
      expect(detail.summary.events_by_type).toHaveProperty('warning', 1);

      // Carts
      expect(detail.carts).toHaveLength(2);
      const cart1 = detail.carts.find((c: any) => c.cart_number === 1);
      expect(cart1).toBeDefined();
      expect(cart1.diver_names).toEqual(['Alice', 'Bob']);
      expect(cart1.cart_type).toBe(2);
      expect(cart1.checkin_count).toBeGreaterThanOrEqual(2);

      const cart2 = detail.carts.find((c: any) => c.cart_number === 2);
      expect(cart2).toBeDefined();
      expect(cart2.diver_names).toEqual(['Charlie', 'Dan', 'Eve']);
      expect(cart2.event_count).toBe(1);

      // Events
      expect(detail.events).toHaveLength(1);
      expect(detail.events[0].event_type).toBe('warning');
      expect(detail.events[0].status).toBe('resolved');
      expect(detail.events[0].cart_number).toBe(2);

      // Timeline
      expect(detail.timeline.length).toBeGreaterThan(0);
      const types = detail.timeline.map((t: any) => t.type);
      expect(types).toContain('dive_start');
      expect(types).toContain('cart_start');
      expect(types).toContain('checkin');
      expect(types).toContain('event_open');
      expect(types).toContain('event_resolve');
    });

    it('timeline is sorted chronologically', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);

      const res = await request(a).get(`/api/reports/dives/${diveId}`);
      const timeline = res.body.timeline;

      for (let i = 1; i < timeline.length; i++) {
        const prev = new Date(timeline[i - 1].timestamp).getTime();
        const curr = new Date(timeline[i].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('includes dive_end in timeline for completed dive', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);
      await request(a).post(`/api/dives/${diveId}/end`);

      const res = await request(a).get(`/api/reports/dives/${diveId}`);
      const types = res.body.timeline.map((t: any) => t.type);
      expect(types).toContain('dive_end');
      expect(types).toContain('cart_end');
    });

    it('includes cart_end in timeline for ended carts', async () => {
      const a = app();
      const { diveId, cart1Id } = await seedDiveData(a);

      // End cart 1
      await request(a).post(`/api/carts/${cart1Id}/end`);

      const res = await request(a).get(`/api/reports/dives/${diveId}`);
      const cartEndEntries = res.body.timeline.filter((t: any) => t.type === 'cart_end');
      expect(cartEndEntries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/reports/dives/:id/export', () => {
    it('returns 404 for non-existent dive', async () => {
      const res = await request(app()).get('/api/reports/dives/9999/export');
      expect(res.status).toBe(404);
    });

    it('returns CSV with BOM and Hebrew content', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);

      const res = await request(a).get(`/api/reports/dives/${diveId}/export`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`dive-report-${diveId}.csv`);

      const csv = res.text;
      // BOM is \ufeff — in UTF-8 it's EF BB BF
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
      expect(csv).toContain('פרטי צלילה');
      expect(csv).toContain('Test Manager');
      expect(csv).toContain('עגלות');
      expect(csv).toContain('אירועים');
      expect(csv).toContain('Alice');
      expect(csv).toContain('Charlie');
    });

    it('CSV contains cart and event rows', async () => {
      const a = app();
      const { diveId } = await seedDiveData(a);

      const res = await request(a).get(`/api/reports/dives/${diveId}/export`);
      const lines = res.text.split('\n');

      // Should have cart rows (header + 2 carts)
      const cartHeaderIdx = lines.findIndex((l: string) => l.includes('מספר עגלה'));
      expect(cartHeaderIdx).toBeGreaterThan(-1);
      // Next 2 lines should be cart data
      expect(lines[cartHeaderIdx + 1]).toContain('Alice');
      expect(lines[cartHeaderIdx + 2]).toContain('Charlie');

      // Should have event rows
      const eventHeaderIdx = lines.findIndex((l: string) => l.includes('סוג,סטטוס,עגלה'));
      expect(eventHeaderIdx).toBeGreaterThan(-1);
    });
  });

  describe('GET /api/reports/daily (legacy)', () => {
    it('returns summary with correct structure', async () => {
      const a = app();
      const today = new Date().toISOString().split('T')[0];
      const res = await request(a).get(`/api/reports/daily?date=${today}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('carts');
      expect(res.body.summary).toHaveProperty('total_carts');
      expect(res.body.summary).toHaveProperty('active_carts');
      expect(res.body.summary).toHaveProperty('completed_carts');
      expect(res.body.summary).toHaveProperty('total_checkins');
      expect(res.body.summary).toHaveProperty('open_events');
      expect(res.body.summary).toHaveProperty('events_by_type');
    });

    it('uses current date when no date param provided', async () => {
      const res = await request(app()).get('/api/reports/daily');
      expect(res.status).toBe(200);
      const today = new Date().toISOString().split('T')[0];
      expect(res.body.date).toBe(today);
    });

    it('returns data for date with carts', async () => {
      const a = app();
      // Create dive + cart
      const diveRes = await request(a).post('/api/dives').send({ manager_name: 'Test' });
      await request(a).post('/api/carts').send({
        cart_number: 1, cart_type: 2, diver_names: ['A', 'B'], dive_id: diveRes.body.id,
      });

      const today = new Date().toISOString().split('T')[0];
      const res = await request(a).get(`/api/reports/daily?date=${today}`);
      expect(res.body.summary.total_carts).toBeGreaterThanOrEqual(1);
      expect(res.body.carts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.carts[0].diver_names).toEqual(['A', 'B']);
    });
  });

  describe('GET /api/reports/export (legacy)', () => {
    it('returns JSON export by default', async () => {
      const a = app();
      const today = new Date().toISOString().split('T')[0];
      const res = await request(a).get(`/api/reports/export?date=${today}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('carts');
      expect(res.body).toHaveProperty('checkins');
      expect(res.body).toHaveProperty('events');
    });

    it('returns CSV when format=csv', async () => {
      const a = app();
      // Create a cart so there's data
      const diveRes = await request(a).post('/api/dives').send({ manager_name: 'Test' });
      await request(a).post('/api/carts').send({
        cart_number: 1, cart_type: 2, diver_names: ['X', 'Y'], dive_id: diveRes.body.id,
      });

      const today = new Date().toISOString().split('T')[0];
      const res = await request(a).get(`/api/reports/export?format=csv&date=${today}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Cart Number');
      expect(res.text).toContain('X, Y');
    });
  });

  describe('Protocols API', () => {
    it('GET /api/protocols — returns empty list initially', async () => {
      const res = await request(app()).get('/api/reports/protocols');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('POST /api/protocols — creates protocol', async () => {
      const a = app();
      const res = await request(a)
        .post('/api/reports/protocols')
        .send({ title: 'Emergency Protocol', content: 'Step 1: Stay calm' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Emergency Protocol');
      expect(res.body.content).toBe('Step 1: Stay calm');
      expect(res.body.id).toBeDefined();
    });

    it('POST /api/protocols — 400 when title missing', async () => {
      const res = await request(app())
        .post('/api/reports/protocols')
        .send({ content: 'Some content' });
      expect(res.status).toBe(400);
    });

    it('POST /api/protocols — 400 when content missing', async () => {
      const res = await request(app())
        .post('/api/reports/protocols')
        .send({ title: 'Some title' });
      expect(res.status).toBe(400);
    });

    it('GET /api/protocols — returns created protocols', async () => {
      const a = app();
      await request(a).post('/api/reports/protocols').send({ title: 'P1', content: 'C1' });
      await request(a).post('/api/reports/protocols').send({ title: 'P2', content: 'C2' });

      const res = await request(a).get('/api/reports/protocols');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('P1');
      expect(res.body[1].title).toBe('P2');
    });
  });
});
