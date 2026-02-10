import type {
  CartWithTimer,
  CheckIn,
  EmergencyEvent,
  CreateCartRequest,
  UpdateCartRequest,
  CheckInRequest,
  ResetTimerRequest,
  CreateEventRequest,
  UpdateEventRequest,
  Protocol,
  Attachment,
  Dive,
  CreateDiveRequest,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Dives
export const diveApi = {
  getActiveDive: () => request<Dive>('/dives/active'),

  createDive: (data: CreateDiveRequest) =>
    request<Dive>('/dives', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  endDive: (id: number) =>
    request<Dive>(`/dives/${id}/end`, { method: 'POST' }),

  updateDive: (id: number, data: Partial<CreateDiveRequest>) =>
    request<Dive>(`/dives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Carts
export const api = {
  // Cart CRUD
  getCarts: () => request<CartWithTimer[]>('/carts'),

  createCart: (data: CreateCartRequest) =>
    request<CartWithTimer>('/carts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCart: (id: number, data: UpdateCartRequest) =>
    request<CartWithTimer>(`/carts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCart: (id: number) =>
    request<{ success: boolean }>(`/carts/${id}`, { method: 'DELETE' }),

  importCarts: (carts: CreateCartRequest[]) =>
    request<{ imported: number; carts: CartWithTimer[] }>('/carts/import', {
      method: 'POST',
      body: JSON.stringify({ carts }),
    }),

  startTimers: (cartIds: number[], location?: string) =>
    request<{ started: number; carts: CartWithTimer[] }>('/carts/start-timers', {
      method: 'POST',
      body: JSON.stringify({ cart_ids: cartIds, location }),
    }),

  updateLocation: (id: number, location: string) =>
    request<CartWithTimer>(`/carts/${id}/location`, {
      method: 'PUT',
      body: JSON.stringify({ location }),
    }),

  endCart: (id: number) =>
    request<CartWithTimer>(`/carts/${id}/end`, { method: 'POST' }),

  // Identification & rounds
  checkIn: (id: number, data?: CheckInRequest) =>
    request<{ cart: CartWithTimer; checkin: CheckIn | null }>(`/carts/${id}/checkin`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  newRound: (id: number, data?: CheckInRequest) =>
    request<{ cart: CartWithTimer; checkin: CheckIn }>(`/carts/${id}/newround`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  resetTimer: (id: number, data: ResetTimerRequest) =>
    request<CartWithTimer>(`/carts/${id}/reset`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHistory: (id: number) =>
    request<CheckIn[]>(`/carts/${id}/history`),

  // Events
  getEvents: (status?: string) =>
    request<EmergencyEvent[]>(`/events${status ? `?status=${status}` : ''}`),

  createEvent: (data: CreateEventRequest) =>
    request<EmergencyEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: number, data: UpdateEventRequest) =>
    request<EmergencyEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Files
  uploadFile: async (cartId: number, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cart_id', String(cartId));

    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  getFiles: (cartId: number) =>
    request<Attachment[]>(`/files/${cartId}`),

  // Reports
  getDailyReport: (date?: string) =>
    request<any>(`/reports/daily${date ? `?date=${date}` : ''}`),

  exportData: (format: string, date?: string) => {
    const params = new URLSearchParams({ format });
    if (date) params.set('date', date);
    return `${API_BASE}/reports/export?${params}`;
  },

  // Protocols
  getProtocols: () => request<Protocol[]>('/protocols'),

  createProtocol: (data: { title: string; content: string }) =>
    request<Protocol>('/protocols', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
