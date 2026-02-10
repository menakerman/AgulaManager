import Database from 'better-sqlite3';
import { vi, beforeEach, afterEach } from 'vitest';
import { createSchema } from '../db/schema';

let testDb: Database.Database;

// Mock getDatabase to return in-memory DB
vi.mock('../db/database', () => ({
  getDatabase: () => testDb,
  closeDatabase: () => {},
}));

// Mock alertService to prevent real socket/timer interactions
vi.mock('../services/alertService', () => ({
  alertService: {
    init: vi.fn(),
    checkCart: vi.fn(),
    resetAlerts: vi.fn(),
  },
}));

// Mock timerService — keep DB-querying methods working, stub init/stop
vi.mock('../services/timerService', async () => {
  // We need to dynamically import after the DB mock is in place,
  // so we re-implement the core logic inline using the mocked getDatabase.
  const { getDatabase } = await import('../db/database');
  const shared = await import('../../../shared/types');

  function getActiveCartsWithTimers() {
    const db = getDatabase();
    const activeDive = db.prepare("SELECT id FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;

    const carts = db.prepare(`
      SELECT c.*,
        (SELECT checked_in_at FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as last_checkin,
        (SELECT next_deadline FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as next_deadline
      FROM carts c
      WHERE c.status = 'active'
        AND (c.dive_id = ? OR (c.dive_id IS NULL AND ? IS NULL))
      ORDER BY c.cart_number
    `).all(activeDive?.id ?? null, activeDive?.id ?? null) as any[];

    const now = new Date();

    return carts.map((cart: any) => {
      let diverNames: string[];
      try { diverNames = JSON.parse(cart.diver_names); } catch { diverNames = [cart.diver_names]; }

      if (cart.last_checkin === null && cart.paused_at === null) {
        return {
          id: cart.id, cart_number: cart.cart_number, cart_type: cart.cart_type,
          diver_names: diverNames, dive_id: cart.dive_id, status: cart.status,
          started_at: cart.started_at, ended_at: cart.ended_at, created_at: cart.created_at,
          last_checkin: null, next_deadline: null, timer_status: 'waiting',
          seconds_remaining: 0, paused_at: null, checkin_location: cart.checkin_location,
        };
      }

      if (cart.paused_at) {
        const deadline = cart.next_deadline
          ? new Date(cart.next_deadline)
          : new Date(new Date(cart.started_at).getTime() + shared.CHECKIN_INTERVAL_MINUTES * 60 * 1000);
        return {
          id: cart.id, cart_number: cart.cart_number, cart_type: cart.cart_type,
          diver_names: diverNames, dive_id: cart.dive_id, status: cart.status,
          started_at: cart.started_at, ended_at: cart.ended_at, created_at: cart.created_at,
          last_checkin: cart.last_checkin, next_deadline: deadline.toISOString(),
          timer_status: 'paused', seconds_remaining: 0, paused_at: cart.paused_at,
          checkin_location: cart.checkin_location,
        };
      }

      const deadline = cart.next_deadline
        ? new Date(cart.next_deadline)
        : new Date(new Date(cart.started_at).getTime() + shared.CHECKIN_INTERVAL_MINUTES * 60 * 1000);
      const secondsRemaining = Math.floor((deadline.getTime() - now.getTime()) / 1000);

      let timerStatus: string;
      if (secondsRemaining <= 0) timerStatus = 'expired';
      else if (secondsRemaining <= shared.WARNING_THRESHOLD_MINUTES * 60) timerStatus = 'orange';
      else timerStatus = 'green';

      return {
        id: cart.id, cart_number: cart.cart_number, cart_type: cart.cart_type,
        diver_names: diverNames, dive_id: cart.dive_id, status: cart.status,
        started_at: cart.started_at, ended_at: cart.ended_at, created_at: cart.created_at,
        last_checkin: cart.last_checkin, next_deadline: deadline.toISOString(),
        timer_status: timerStatus, seconds_remaining: Math.max(0, secondsRemaining),
        paused_at: cart.paused_at, checkin_location: cart.checkin_location,
      };
    });
  }

  return {
    timerService: {
      init: vi.fn(),
      stop: vi.fn(),
      getActiveCartsWithTimers,
      getCartWithTimer: (cartId: number) => {
        return getActiveCartsWithTimers().find((c: any) => c.id === cartId) || null;
      },
    },
  };
});

// Mock backupService
vi.mock('../services/backupService', () => ({
  backupService: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  createSchema(testDb);
});

afterEach(() => {
  testDb.close();
});
