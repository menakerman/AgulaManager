import { useState, useEffect } from 'react';
import { useCartStore } from '../stores/cartStore';
import { useAlertStore } from '../stores/alertStore';
import { useDiveStore } from '../stores/diveStore';
import type { CartWithTimer } from '../types';
import CartGrid from './CartGrid';
import CartForm from './CartForm';
import CartImport from './CartImport';
import SearchFilter from './SearchFilter';
import DiveGate from './DiveGate';
import DiveInfoBar from './DiveInfoBar';

export default function Dashboard() {
  const { carts, loading, error, fetchCarts, filteredCarts } = useCartStore();
  const activeAlertCount = useAlertStore((s) => s.activeAlertCount);
  const { dive, loading: diveLoading } = useDiveStore();
  const [showCartForm, setShowCartForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingCart, setEditingCart] = useState<CartWithTimer | null>(null);

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

  const displayed = filteredCarts();
  const activeCarts = carts.filter((c) => c.timer_status === 'green').length;
  const warningCarts = carts.filter((c) => c.timer_status === 'orange').length;
  const expiredCarts = carts.filter((c) => c.timer_status === 'expired').length;

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{carts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">עגלות פעילות</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-success-600">{activeCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">תקין</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-warning-600">{warningCarts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">אזהרה</div>
        </div>
        <div className="card p-4 text-center">
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
        <SearchFilter />
      </div>

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
      ) : (
        <CartGrid carts={displayed} onEditCart={handleEdit} />
      )}

      {/* Modals */}
      {showCartForm && (
        <CartForm editCart={editingCart} onClose={handleCloseForm} />
      )}
      {showImport && (
        <CartImport onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
