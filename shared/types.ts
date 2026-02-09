// Shared types between client and server

export type CartType = 'pair' | 'trio' | 'six';
export type CartStatus = 'active' | 'completed';
export type EventType = 'warning' | 'overdue' | 'emergency';
export type EventStatus = 'open' | 'resolved';
export type TimerStatus = 'green' | 'orange' | 'red' | 'expired' | 'paused';

export interface Cart {
  id: number;
  cart_number: number;
  cart_type: CartType;
  diver_names: string[];
  status: CartStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface CartWithTimer extends Cart {
  last_checkin: string | null;
  next_deadline: string | null;
  timer_status: TimerStatus;
  seconds_remaining: number;
  paused_at: string | null;
}

export interface CheckIn {
  id: number;
  cart_id: number;
  checked_in_at: string;
  next_deadline: string;
  reset_reason: string | null;
  location: string | null;
  created_at: string;
}

export interface EmergencyEvent {
  id: number;
  cart_id: number;
  event_type: EventType;
  status: EventStatus;
  opened_at: string;
  resolved_at: string | null;
  notes: string[];
  created_at: string;
}

export interface Attachment {
  id: number;
  cart_id: number;
  filename: string;
  filepath: string;
  uploaded_at: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Protocol {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

// API request/response types
export interface CreateCartRequest {
  cart_number: number;
  cart_type?: CartType;
  diver_names: string[];
}

export interface UpdateCartRequest {
  cart_number?: number;
  cart_type?: CartType;
  diver_names?: string[];
}

export interface CheckInRequest {
  location?: string;
}

export interface ResetTimerRequest {
  reason: string;
}

export interface CreateEventRequest {
  cart_id: number;
  event_type: EventType;
  notes?: string;
}

export interface UpdateEventRequest {
  status?: EventStatus;
  notes?: string[];
  resolved_at?: string;
}

export interface CreateProtocolRequest {
  title: string;
  content: string;
}

// Socket.io event types
export interface ServerToClientEvents {
  'cart:updated': (cart: CartWithTimer) => void;
  'cart:created': (cart: CartWithTimer) => void;
  'cart:deleted': (cartId: number) => void;
  'cart:ended': (cart: CartWithTimer) => void;
  'checkin:recorded': (data: { cart: CartWithTimer; checkin: CheckIn }) => void;
  'timer:tick': (carts: CartWithTimer[]) => void;
  'alert:warning': (cart: CartWithTimer) => void;
  'alert:overdue': (cart: CartWithTimer) => void;
  'alert:emergency': (cart: CartWithTimer) => void;
  'event:created': (event: EmergencyEvent) => void;
  'event:updated': (event: EmergencyEvent) => void;
}

export interface ClientToServerEvents {
  'cart:subscribe': () => void;
}

// Constants
export const CHECKIN_INTERVAL_MINUTES = 60;
export const WARNING_THRESHOLD_MINUTES = 10; // Orange at 10 min remaining
export const OVERDUE_THRESHOLD_MINUTES = 0;  // Red at 0 min remaining

// Round a deadline to the nearest 5-minute mark on the clock
// (divers use analog clocks and can't read single minutes)
export function roundToNearest5Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    // Round to nearest 5 (e.g. 03->05, 07->05, 08->10)
    if (remainder < 3) {
      rounded.setMinutes(minutes - remainder);
    } else {
      rounded.setMinutes(minutes + (5 - remainder));
    }
  }
  rounded.setSeconds(0, 0);
  return rounded;
}
