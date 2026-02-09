import { create } from 'zustand';
import type { CartWithTimer, EmergencyEvent } from '../types';
import { api } from '../services/api';

interface Alert {
  id: string;
  type: 'warning' | 'overdue' | 'emergency';
  cart: CartWithTimer;
  timestamp: string;
  dismissed: boolean;
}

interface AlertState {
  alerts: Alert[];
  events: EmergencyEvent[];
  showAlertCenter: boolean;

  addAlert: (type: Alert['type'], cart: CartWithTimer) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
  setShowAlertCenter: (show: boolean) => void;

  fetchEvents: (status?: string) => Promise<void>;
  resolveEvent: (id: number) => Promise<void>;
  addEventNote: (id: number, note: string) => Promise<void>;

  activeAlertCount: () => number;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  events: [],
  showAlertCenter: false,

  addAlert: (type, cart) => {
    const alert: Alert = {
      id: `${type}-${cart.id}-${Date.now()}`,
      type,
      cart,
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 100) }));
  },

  dismissAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    }));
  },

  clearAlerts: () => set({ alerts: [] }),

  setShowAlertCenter: (show) => set({ showAlertCenter: show }),

  fetchEvents: async (status) => {
    try {
      const events = await api.getEvents(status);
      set({ events });
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  },

  resolveEvent: async (id) => {
    try {
      await api.updateEvent(id, { status: 'resolved' });
      set((state) => ({
        events: state.events.map((e) =>
          e.id === id ? { ...e, status: 'resolved', resolved_at: new Date().toISOString() } : e
        ),
      }));
    } catch (err) {
      console.error('Failed to resolve event:', err);
    }
  },

  addEventNote: async (id, note) => {
    const event = get().events.find((e) => e.id === id);
    if (!event) return;
    const notes = [...event.notes, note];
    try {
      await api.updateEvent(id, { notes });
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? { ...e, notes } : e)),
      }));
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  },

  activeAlertCount: () => get().alerts.filter((a) => !a.dismissed).length,
}));
