import { Server as SocketServer } from 'socket.io';
import { getDatabase } from '../db/database';
import { alertService } from './alertService';
import type { CartWithTimer, TimerStatus } from '../../../shared/types';
import { CHECKIN_INTERVAL_MINUTES, WARNING_THRESHOLD_MINUTES } from '../../../shared/types';

class TimerService {
  private io: SocketServer | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  init(io: SocketServer): void {
    this.io = io;
    this.startMonitoring();
    console.log('Timer service initialized');
  }

  private startMonitoring(): void {
    // Check every second
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    const carts = this.getActiveCartsWithTimers();
    if (carts.length > 0 && this.io) {
      this.io.emit('timer:tick', carts);

      // Check for alerts (skip paused and waiting carts)
      for (const cart of carts) {
        if (cart.timer_status !== 'paused' && cart.timer_status !== 'waiting') {
          alertService.checkCart(cart);
        }
      }
    }
  }

  getActiveCartsWithTimers(): CartWithTimer[] {
    const db = getDatabase();

    // Only return carts belonging to the current active dive
    const activeDive = db.prepare("SELECT id FROM dives WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;

    const carts = db.prepare(`
      SELECT c.*,
        (SELECT checked_in_at FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as last_checkin,
        (SELECT next_deadline FROM checkins WHERE cart_id = c.id ORDER BY checked_in_at DESC LIMIT 1) as next_deadline
      FROM carts c
      WHERE c.status = 'active'
        AND (c.dive_id = ? OR (c.dive_id IS NULL AND ? IS NULL))
      ORDER BY c.cart_number
    `).all(activeDive?.id ?? null, activeDive?.id ?? null) as Array<{
      id: number;
      cart_number: number;
      cart_type: number;
      diver_names: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      paused_at: string | null;
      checkin_location: string | null;
      created_at: string;
      last_checkin: string | null;
      next_deadline: string | null;
      dive_id: number | null;
    }>;

    const now = new Date();

    return carts.map(cart => {
      // If cart has no checkin and is not paused, it's in waiting state
      if (cart.last_checkin === null && cart.paused_at === null) {
        let diverNames: string[];
        try {
          diverNames = JSON.parse(cart.diver_names);
        } catch {
          diverNames = [cart.diver_names];
        }

        return {
          id: cart.id,
          cart_number: cart.cart_number,
          cart_type: cart.cart_type,
          diver_names: diverNames,
          dive_id: cart.dive_id,
          status: cart.status as CartWithTimer['status'],
          started_at: cart.started_at,
          ended_at: cart.ended_at,
          created_at: cart.created_at,
          last_checkin: null,
          next_deadline: null,
          timer_status: 'waiting' as TimerStatus,
          seconds_remaining: 0,
          paused_at: null,
          checkin_location: cart.checkin_location,
        };
      }

      // If cart is paused, show paused status
      if (cart.paused_at) {
        let diverNames: string[];
        try {
          diverNames = JSON.parse(cart.diver_names);
        } catch {
          diverNames = [cart.diver_names];
        }

        const deadline = cart.next_deadline
          ? new Date(cart.next_deadline)
          : new Date(new Date(cart.started_at).getTime() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);

        return {
          id: cart.id,
          cart_number: cart.cart_number,
          cart_type: cart.cart_type,
          diver_names: diverNames,
          dive_id: cart.dive_id,
          status: cart.status as CartWithTimer['status'],
          started_at: cart.started_at,
          ended_at: cart.ended_at,
          created_at: cart.created_at,
          last_checkin: cart.last_checkin,
          next_deadline: deadline.toISOString(),
          timer_status: 'paused' as TimerStatus,
          seconds_remaining: 0,
          paused_at: cart.paused_at,
          checkin_location: cart.checkin_location,
        };
      }

      const deadline = cart.next_deadline
        ? new Date(cart.next_deadline)
        : new Date(new Date(cart.started_at).getTime() + CHECKIN_INTERVAL_MINUTES * 60 * 1000);

      const secondsRemaining = Math.floor((deadline.getTime() - now.getTime()) / 1000);

      let timerStatus: TimerStatus;
      if (secondsRemaining <= 0) {
        timerStatus = 'expired';
      } else if (secondsRemaining <= WARNING_THRESHOLD_MINUTES * 60) {
        timerStatus = 'orange';
      } else {
        timerStatus = 'green';
      }

      let diverNames: string[];
      try {
        diverNames = JSON.parse(cart.diver_names);
      } catch {
        diverNames = [cart.diver_names];
      }

      return {
        id: cart.id,
        cart_number: cart.cart_number,
        cart_type: cart.cart_type,
        diver_names: diverNames,
        dive_id: cart.dive_id,
        status: cart.status as CartWithTimer['status'],
        started_at: cart.started_at,
        ended_at: cart.ended_at,
        created_at: cart.created_at,
        last_checkin: cart.last_checkin,
        next_deadline: deadline.toISOString(),
        timer_status: timerStatus,
        seconds_remaining: Math.max(0, secondsRemaining),
        paused_at: cart.paused_at,
        checkin_location: cart.checkin_location,
      };
    });
  }

  getCartWithTimer(cartId: number): CartWithTimer | null {
    const carts = this.getActiveCartsWithTimers();
    return carts.find(c => c.id === cartId) || null;
  }
}

export const timerService = new TimerService();
