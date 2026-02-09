import { Server as SocketServer } from 'socket.io';
import { getDatabase } from '../db/database';
import type { CartWithTimer, EventType } from '../../../shared/types';

class AlertService {
  private io: SocketServer | null = null;
  // Track which alerts have been sent per cart to avoid duplicates
  private sentAlerts: Map<number, Set<string>> = new Map();

  init(io: SocketServer): void {
    this.io = io;
    console.log('Alert service initialized');
  }

  checkCart(cart: CartWithTimer): void {
    if (!this.io) return;

    const alertKey = `${cart.id}`;
    if (!this.sentAlerts.has(cart.id)) {
      this.sentAlerts.set(cart.id, new Set());
    }
    const sent = this.sentAlerts.get(cart.id)!;

    // Warning: 10 minutes remaining
    if (cart.timer_status === 'orange' && !sent.has('warning')) {
      sent.add('warning');
      this.io.emit('alert:warning', cart);
      this.createEvent(cart.id, 'warning');
    }

    // Overdue: timer expired
    if (cart.timer_status === 'expired' && !sent.has('overdue')) {
      sent.add('overdue');
      this.io.emit('alert:overdue', cart);
      this.createEvent(cart.id, 'overdue');
    }

    // Emergency: 15 minutes past expiry
    if (cart.timer_status === 'expired' && cart.seconds_remaining === 0) {
      const deadline = new Date(cart.next_deadline!);
      const now = new Date();
      const minutesPastDue = (now.getTime() - deadline.getTime()) / (60 * 1000);

      if (minutesPastDue >= 15 && !sent.has('emergency')) {
        sent.add('emergency');
        this.io.emit('alert:emergency', cart);
        this.createEvent(cart.id, 'emergency');
      }
    }
  }

  // Reset alerts for a cart (called after check-in)
  resetAlerts(cartId: number): void {
    this.sentAlerts.delete(cartId);
  }

  private createEvent(cartId: number, eventType: EventType): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare(
        'INSERT INTO events (cart_id, event_type, opened_at, notes) VALUES (?, ?, ?, ?)'
      );
      stmt.run(cartId, eventType, new Date().toISOString(), JSON.stringify([]));
    } catch (err) {
      console.error('Error creating event:', err);
    }
  }
}

export const alertService = new AlertService();
