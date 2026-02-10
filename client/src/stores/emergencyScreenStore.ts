import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
}

export interface EmergencySession {
  id: string;
  cartId: number;
  cartNumber: number;
  diverNames: string[];
  triggeredAt: string;
  checklist: ChecklistItem[];
  minimized: boolean;
  resolved: boolean;
}

interface EmergencyScreenState {
  sessions: EmergencySession[];
  activeSessionId: string | null;

  startEmergency: (cartId: number, cartNumber: number, diverNames: string[]) => void;
  resolveEmergency: (sessionId: string) => void;
  toggleMinimize: (sessionId: string) => void;
  expandSession: (sessionId: string) => void;
  addChecklistItem: (sessionId: string, text: string) => void;
  removeChecklistItem: (sessionId: string, itemId: string) => void;
  toggleChecklistItem: (sessionId: string, itemId: string) => void;
  loadChecklistFromFile: (sessionId: string, items: string[]) => void;
}

export const useEmergencyScreenStore = create<EmergencyScreenState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      startEmergency: (cartId, cartNumber, diverNames) => {
        const existing = get().sessions.find(
          (s) => s.cartId === cartId && !s.resolved
        );
        if (existing) return;

        const session: EmergencySession = {
          id: `emergency-${cartId}-${Date.now()}`,
          cartId,
          cartNumber,
          diverNames,
          triggeredAt: new Date().toISOString(),
          checklist: [],
          minimized: false,
          resolved: false,
        };

        set((state) => ({
          sessions: [...state.sessions, session],
          activeSessionId: session.id,
        }));
      },

      resolveEmergency: (sessionId) => {
        set((state) => {
          const updated = state.sessions.map((s) =>
            s.id === sessionId ? { ...s, resolved: true } : s
          );
          const remaining = updated.filter((s) => !s.resolved);
          return {
            sessions: updated,
            activeSessionId:
              state.activeSessionId === sessionId
                ? remaining.length > 0
                  ? remaining[0].id
                  : null
                : state.activeSessionId,
          };
        });
      },

      toggleMinimize: (sessionId) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (!session) return state;
          const nowMinimized = !session.minimized;
          return {
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, minimized: nowMinimized } : s
            ),
            activeSessionId: nowMinimized ? null : sessionId,
          };
        });
      },

      expandSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, minimized: false } : s
          ),
          activeSessionId: sessionId,
        }));
      },

      addChecklistItem: (sessionId, text) => {
        const item: ChecklistItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text,
          completed: false,
          completedAt: null,
        };
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, checklist: [...s.checklist, item] }
              : s
          ),
        }));
      },

      removeChecklistItem: (sessionId, itemId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, checklist: s.checklist.filter((i) => i.id !== itemId) }
              : s
          ),
        }));
      },

      toggleChecklistItem: (sessionId, itemId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  checklist: s.checklist.map((i) =>
                    i.id === itemId
                      ? {
                          ...i,
                          completed: !i.completed,
                          completedAt: !i.completed
                            ? new Date().toISOString()
                            : null,
                        }
                      : i
                  ),
                }
              : s
          ),
        }));
      },

      loadChecklistFromFile: (sessionId, items) => {
        const newItems: ChecklistItem[] = items
          .filter((t) => t.trim().length > 0)
          .map((text) => ({
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: text.trim(),
            completed: false,
            completedAt: null,
          }));
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, checklist: [...s.checklist, ...newItems] }
              : s
          ),
        }));
      },
    }),
    {
      name: 'emergency-screen-storage',
    }
  )
);
