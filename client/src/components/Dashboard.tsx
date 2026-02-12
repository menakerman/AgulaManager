import { useState, useEffect, useRef, useMemo } from 'react';
import { useCartStore } from '../stores/cartStore';
import { useAlertStore } from '../stores/alertStore';
import { useDiveStore } from '../stores/diveStore';
import type { CartWithTimer } from '../types';
import CartGrid from './CartGrid';
import CartTable from './CartTable';
import CartForm from './CartForm';
import CartImport from './CartImport';
import SearchFilter from './SearchFilter';
import DiveGate from './DiveGate';
import DiveInfoBar from './DiveInfoBar';

const URGENCY_ORDER: Record<string, number> = {
  expired: 0,
  red: 0,
  orange: 1,
  green: 2,
  paused: 3,
  waiting: 4,
};

function sortByUrgency(carts: CartWithTimer[]): CartWithTimer[] {
  return [...carts].sort((a, b) => {
    const pa = URGENCY_ORDER[a.timer_status] ?? 5;
    const pb = URGENCY_ORDER[b.timer_status] ?? 5;
    if (pa !== pb) return pa - pb;
    return a.seconds_remaining - b.seconds_remaining;
  });
}

const STATUS_INFO: Record<string, { title: string; description: string; trigger: string }> = {
  waiting: {
    title: 'ממתין',
    description: 'עגלות שנוצרו אך עדיין לא התחילו את העגולה.',
    trigger: 'עגלה נכנסת לסטטוס זה ברגע שהיא נוצרת, לפני לחיצה על "התחל עגולה".',
  },
  active: {
    title: 'תקין',
    description: 'עגלות עם טיימר פעיל שהזמן שנותר מעל 10 דקות.',
    trigger: 'עגלה נכנסת לסטטוס זה לאחר התחלת עגולה או לאחר הזדהות שמאפסת את הטיימר.',
  },
  warning: {
    title: 'אזהרה',
    description: 'עגלות שנותרו להן פחות מ-10 דקות עד לתום הזמן.',
    trigger: 'עגלה עוברת לסטטוס זה 10 דקות לפני תום זמן ההזדהות.',
  },
  expired: {
    title: 'חריגה',
    description: 'עגלות שחרגו מזמן ההזדהות ולא בוצעה הזדהות בזמן.',
    trigger: 'עגלה עוברת לסטטוס זה כאשר הטיימר מגיע ל-0 ולא בוצעה הזדהות.',
  },
};

function InfoButton({ infoKey }: { infoKey: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const info = STATUS_INFO[infoKey];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!info) return null;

  return (
    <div ref={ref} className="absolute top-2 start-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-xs font-bold leading-none transition-colors"
      >
        i
      </button>
      {open && (
        <div className="absolute top-7 start-0 z-50 w-56 p-3 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-right">
          <div className="font-bold text-sm mb-1">{info.title}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{info.description}</div>
          <div className="text-xs text-primary-600 dark:text-primary-400">{info.trigger}</div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { carts, loading, error, fetchCarts, filteredCarts, selectedCartIds, toggleCartSelection, selectAllWaiting, clearSelection, startTimers } = useCartStore();
  const activeAlertCount = useAlertStore((s) => s.activeAlertCount);
  const { dive, loading: diveLoading } = useDiveStore();
  const [showCartForm, setShowCartForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingCart, setEditingCart] = useState<CartWithTimer | null>(null);
  const [showBulkStartModal, setShowBulkStartModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  const handleEdit = (cart: CartWithTimer) => {
    setEditingCart(cart);
    setShowCartForm(true);
  };

  const handleCloseForm = () => {
    setShowCartForm(false);
    setEditingCart(null);
  };

  const filtered = filteredCarts();
  const displayed = useMemo(() => sortByUrgency(filtered), [filtered]);
  const waitingCarts = carts.filter((c) => c.timer_status === 'waiting').length;
  const activeCarts = carts.filter((c) => c.timer_status === 'green').length;
  const warningCarts = carts.filter((c) => c.timer_status === 'orange').length;
  const expiredCarts = carts.filter((c) => c.timer_status === 'expired').length;
  const selectedCount = selectedCartIds.size;

  if (diveLoading) {
    return (
      <div className="text-center py-16">
        <svg className="animate-spin h-8 w-8 mx-auto text-primary-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-500 mt-4">טוען...</p>
      </div>
    );
  }

  if (!dive) {
    return <DiveGate />;
  }

  return (
    <div className="space-y-6">
      <DiveInfoBar />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{carts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">עגלות פעילות</div>
        </div>
        <div className="card p-4 text-center relative">
          <InfoButton infoKey="waiting" />
          <div className="text-3xl font-bold text-gray-500">{waitingCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">ממתין</div>
        </div>
        <div className="card p-4 text-center relative">
          <InfoButton infoKey="active" />
          <div className="text-3xl font-bold text-success-600">{activeCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">תקין</div>
        </div>
        <div className="card p-4 text-center relative">
          <InfoButton infoKey="warning" />
          <div className="text-3xl font-bold text-warning-600">{warningCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">אזהרה</div>
        </div>
        <div className="card p-4 text-center relative">
          <InfoButton infoKey="expired" />
          <div className="text-3xl font-bold text-danger-600">{expiredCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">חריגה</div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setShowCartForm(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            עגלה חדשה
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            ייבוא
          </button>
        </div>
        <div className="flex items-center gap-2">
          <SearchFilter />
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="תצוגת כרטיסים"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="תצוגת טבלה"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions for waiting carts */}
      {waitingCarts > 0 && (
        <div className="flex flex-wrap gap-3 items-center card p-3">
          <button onClick={selectAllWaiting} className="btn-secondary text-sm py-1.5 px-3">
            בחר ממתינים ({waitingCarts})
          </button>
          {selectedCount > 0 && (
            <>
              <button
                onClick={() => setShowBulkStartModal(true)}
                className="btn-primary text-sm py-1.5 px-3"
              >
                התחל עגולה ({selectedCount})
              </button>
              <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline">
                נקה בחירה
              </button>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-warning-50 dark:bg-yellow-900/20 text-warning-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16">
          <svg className="animate-spin h-8 w-8 mx-auto text-primary-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 mt-4">טוען עגלות...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <CartGrid carts={displayed} onEditCart={handleEdit} selectedCartIds={selectedCartIds} onToggleSelect={toggleCartSelection} />
      ) : (
        <CartTable carts={displayed} onEditCart={handleEdit} selectedCartIds={selectedCartIds} onToggleSelect={toggleCartSelection} />
      )}

      {/* Modals */}
      {showCartForm && (
        <CartForm editCart={editingCart} onClose={handleCloseForm} />
      )}
      {showImport && (
        <CartImport onClose={() => setShowImport(false)} />
      )}
      {showBulkStartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkStartModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">התחל עגולה ל-{selectedCount} עגלות?</h3>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkStartModal(false)} className="btn-secondary">ביטול</button>
              <button
                onClick={async () => {
                  await startTimers([...selectedCartIds]);
                  setShowBulkStartModal(false);
                }}
                className="btn-primary"
              >
                התחל עגולה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
