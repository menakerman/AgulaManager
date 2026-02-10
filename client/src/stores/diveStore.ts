import { create } from 'zustand';
import type { Dive, CreateDiveRequest } from '../types';
import { diveApi } from '../services/api';
import { useCartStore } from './cartStore';

interface DiveState {
  dive: Dive | null;
  loading: boolean;

  fetchActiveDive: () => Promise<void>;
  startDive: (data: CreateDiveRequest) => Promise<Dive>;
  endDive: () => Promise<void>;
  updateDive: (data: Partial<CreateDiveRequest>) => Promise<void>;
}

export const useDiveStore = create<DiveState>((set, get) => ({
  dive: null,
  loading: true,

  fetchActiveDive: async () => {
    set({ loading: true });
    try {
      const dive = await diveApi.getActiveDive();
      set({ dive, loading: false });
    } catch {
      set({ dive: null, loading: false });
    }
  },

  startDive: async (data) => {
    const dive = await diveApi.createDive(data);
    set({ dive });
    // Refresh carts to show clean slate for the new dive
    useCartStore.getState().fetchCarts();
    return dive;
  },

  endDive: async () => {
    const { dive } = get();
    if (!dive) return;
    await diveApi.endDive(dive.id);
    set({ dive: null });
    // Refresh carts to clear all ended carts
    useCartStore.getState().fetchCarts();
  },

  updateDive: async (data) => {
    const { dive } = get();
    if (!dive) return;
    const updated = await diveApi.updateDive(dive.id, data);
    set({ dive: updated });
  },
}));
