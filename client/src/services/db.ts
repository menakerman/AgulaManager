import Dexie, { type Table } from 'dexie';
import type { CartWithTimer, CheckIn, EmergencyEvent } from '../types';

interface PendingAction {
  id?: number;
  type: 'checkin' | 'createCart' | 'endCart' | 'resetTimer';
  payload: Record<string, unknown>;
  timestamp: string;
}

class AgulaDB extends Dexie {
  carts!: Table<CartWithTimer, number>;
  checkins!: Table<CheckIn, number>;
  events!: Table<EmergencyEvent, number>;
  pendingActions!: Table<PendingAction, number>;

  constructor() {
    super('AgulaManager');
    this.version(1).stores({
      carts: 'id, cart_number, status',
      checkins: 'id, cart_id, checked_in_at',
      events: 'id, cart_id, status',
      pendingActions: '++id, type, timestamp',
    });
  }
}

export const offlineDb = new AgulaDB();

// Save carts to offline storage
export async function saveCarts(carts: CartWithTimer[]): Promise<void> {
  await offlineDb.carts.clear();
  await offlineDb.carts.bulkPut(carts);
}

// Get carts from offline storage
export async function getOfflineCarts(): Promise<CartWithTimer[]> {
  return offlineDb.carts.where('status').equals('active').toArray();
}

// Queue action for when back online
export async function queueAction(action: Omit<PendingAction, 'id'>): Promise<void> {
  await offlineDb.pendingActions.add(action as PendingAction);
}

// Get pending actions
export async function getPendingActions(): Promise<PendingAction[]> {
  return offlineDb.pendingActions.orderBy('timestamp').toArray();
}

// Clear pending actions after sync
export async function clearPendingActions(): Promise<void> {
  await offlineDb.pendingActions.clear();
}
