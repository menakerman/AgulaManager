import { create } from 'zustand';
import type { CartWithTimer, CreateCartRequest, UpdateCartRequest, CheckInRequest, ResetTimerRequest } from '../types';
import { api } from '../services/api';
import { saveCarts, getOfflineCarts, queueAction } from '../services/db';

interface CartState {
  carts: CartWithTimer[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterStatus: 'all' | 'waiting' | 'green' | 'orange' | 'expired';
  selectedCartIds: Set<number>;

  // Actions
  setCarts: (carts: CartWithTimer[]) => void;
  updateCart: (cart: CartWithTimer) => void;
  removeCart: (cartId: number) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: 'all' | 'waiting' | 'green' | 'orange' | 'expired') => void;
  toggleCartSelection: (id: number) => void;
  selectAllWaiting: () => void;
  clearSelection: () => void;

  // API actions
  fetchCarts: () => Promise<void>;
  createCart: (data: CreateCartRequest) => Promise<CartWithTimer>;
  editCart: (id: number, data: UpdateCartRequest) => Promise<void>;
  deleteCart: (id: number) => Promise<void>;
  importCarts: (carts: CreateCartRequest[]) => Promise<number>;
  endCart: (id: number) => Promise<void>;
  checkIn: (id: number, data?: CheckInRequest) => Promise<void>;
  newRound: (id: number, data?: CheckInRequest) => Promise<void>;
  resetTimer: (id: number, data: ResetTimerRequest) => Promise<void>;
  startTimers: (cartIds: number[], location?: string) => Promise<void>;
  updateLocation: (id: number, location: string) => Promise<void>;

  // Computed
  filteredCarts: () => CartWithTimer[];
}

export const useCartStore = create<CartState>((set, get) => ({
  carts: [],
  loading: false,
  error: null,
  searchQuery: '',
  filterStatus: 'all',
  selectedCartIds: new Set<number>(),

  setCarts: (carts) => {
    set({ carts });
    saveCarts(carts).catch(console.error);
  },

  updateCart: (cart) => {
    set((state) => ({
      carts: state.carts.map((c) => (c.id === cart.id ? cart : c)),
    }));
  },

  removeCart: (cartId) => {
    set((state) => ({
      carts: state.carts.filter((c) => c.id !== cartId),
    }));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterStatus: (status) => set({ filterStatus: status }),

  toggleCartSelection: (id) => set((state) => {
    const next = new Set(state.selectedCartIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedCartIds: next };
  }),

  selectAllWaiting: () => set((state) => {
    const waitingIds = state.carts
      .filter((c) => c.timer_status === 'waiting')
      .map((c) => c.id);
    return { selectedCartIds: new Set(waitingIds) };
  }),

  clearSelection: () => set({ selectedCartIds: new Set<number>() }),

  fetchCarts: async () => {
    set({ loading: true, error: null });
    try {
      const carts = await api.getCarts();
      set({ carts, loading: false });
      saveCarts(carts).catch(console.error);
    } catch (err) {
      // Try offline
      try {
        const offlineCarts = await getOfflineCarts();
        set({ carts: offlineCarts, loading: false, error: 'עובד במצב לא מקוון' });
      } catch {
        set({ loading: false, error: 'שגיאה בטעינת העגלות' });
      }
    }
  },

  createCart: async (data) => {
    const cart = await api.createCart(data);
    set((state) => ({ carts: [...state.carts, cart] }));
    return cart;
  },

  editCart: async (id, data) => {
    const cart = await api.updateCart(id, data);
    set((state) => ({
      carts: state.carts.map((c) => (c.id === id ? cart : c)),
    }));
  },

  deleteCart: async (id) => {
    await api.deleteCart(id);
    set((state) => ({
      carts: state.carts.filter((c) => c.id !== id),
    }));
  },

  importCarts: async (carts) => {
    const result = await api.importCarts(carts);
    await get().fetchCarts();
    return result.imported;
  },

  endCart: async (id) => {
    try {
      await api.endCart(id);
    } catch {
      await queueAction({ type: 'endCart', payload: { id }, timestamp: new Date().toISOString() });
    }
    set((state) => ({
      carts: state.carts.filter((c) => c.id !== id),
    }));
  },

  checkIn: async (id, data) => {
    try {
      console.log('checkIn: calling API for cart', id);
      const result = await api.checkIn(id, data);
      console.log('checkIn: API response', result);
      set((state) => ({
        carts: state.carts.map((c) => (c.id === id ? result.cart : c)),
      }));
    } catch (err) {
      console.error('checkIn: API failed', err);
      await queueAction({
        type: 'checkin',
        payload: { id, ...data },
        timestamp: new Date().toISOString(),
      });
    }
  },

  newRound: async (id, data) => {
    try {
      const result = await api.newRound(id, data);
      set((state) => ({
        carts: state.carts.map((c) => (c.id === id ? result.cart : c)),
      }));
    } catch {
      await queueAction({
        type: 'checkin',
        payload: { id, ...data },
        timestamp: new Date().toISOString(),
      });
    }
  },

  resetTimer: async (id, data) => {
    try {
      const cart = await api.resetTimer(id, data);
      set((state) => ({
        carts: state.carts.map((c) => (c.id === id ? cart : c)),
      }));
    } catch {
      await queueAction({
        type: 'resetTimer',
        payload: { id, ...data },
        timestamp: new Date().toISOString(),
      });
    }
  },

  startTimers: async (cartIds, location) => {
    const result = await api.startTimers(cartIds, location);
    set((state) => {
      const updatedMap = new Map(result.carts.map((c) => [c.id, c]));
      return {
        carts: state.carts.map((c) => updatedMap.get(c.id) ?? c),
        selectedCartIds: new Set<number>(),
      };
    });
  },

  updateLocation: async (id, location) => {
    const cart = await api.updateLocation(id, location);
    set((state) => ({
      carts: state.carts.map((c) => (c.id === id ? cart : c)),
    }));
  },

  filteredCarts: () => {
    const { carts, searchQuery, filterStatus } = get();
    let filtered = carts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.cart_number.toString().includes(q) ||
          c.diver_names.some((n) => n.toLowerCase().includes(q))
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((c) => c.timer_status === filterStatus);
    }

    return filtered;
  },
}));
