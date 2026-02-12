import { useState, useRef, useEffect } from 'react';
import type { CartWithTimer } from '../types';
import { DEFAULT_DIVE_SETTINGS } from '../types';
import { useTimer } from '../hooks/useTimer';
import { useCartStore } from '../stores/cartStore';
import { useDiveStore } from '../stores/diveStore';
import CheckInButton from './CheckInButton';
import { formatClockTime } from '../utils/time';

interface CartTableProps {
  carts: CartWithTimer[];
  onEditCart: (cart: CartWithTimer) => void;
  selectedCartIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  waiting: 'ממתין',
  green: 'תקין',
  orange: 'אזהרה',
  expired: 'חריגה',
  red: 'חריגה',
  paused: 'מושהה',
};

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
  green: 'bg-success-100 text-success-700 dark:bg-green-900/40 dark:text-green-300',
  orange: 'bg-warning-100 text-warning-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  expired: 'bg-danger-100 text-danger-700 dark:bg-red-900/40 dark:text-red-300',
  red: 'bg-danger-100 text-danger-700 dark:bg-red-900/40 dark:text-red-300',
  paused: 'bg-primary-100 text-primary-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function CartTableRow({ cart, onEditCart, isSelected, onToggleSelect }: {
  cart: CartWithTimer;
  onEditCart: (cart: CartWithTimer) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const isWaiting = cart.timer_status === 'waiting';
  const isPaused = cart.timer_status === 'paused';
  const diveSettings = useDiveStore((s) => s.dive?.settings) ?? DEFAULT_DIVE_SETTINGS;
  const timer = useTimer(isPaused || isWaiting ? null : cart.next_deadline, diveSettings.agula_period_minutes, diveSettings.warning_minutes);
  const { endCart, deleteCart } = useCartStore();

  const liveStatus = isWaiting ? 'waiting' : isPaused ? 'paused' : timer.status;

  useEffect(() => {
    if (!showActions) return;
    const handleClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActions]);

  const handleEnd = async () => {
    if (confirm('האם לסיים את פעילות העגלה?')) {
      await endCart(cart.id);
    }
  };

  const handleDelete = async () => {
    if (confirm('האם למחוק את העגלה? פעולה זו לא ניתנת לביטול.')) {
      await deleteCart(cart.id);
    }
  };

  const rowBorder =
    liveStatus === 'expired' || liveStatus === 'red'
      ? 'border-r-4 border-r-danger-500'
      : liveStatus === 'orange'
        ? 'border-r-4 border-r-warning-500'
        : liveStatus === 'green'
          ? 'border-r-4 border-r-success-500'
          : liveStatus === 'paused'
            ? 'border-r-4 border-r-primary-500'
            : 'border-r-4 border-r-gray-300 dark:border-r-gray-600';

  return (
    <tr className={`${rowBorder} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
      {/* Selection checkbox */}
      <td className="px-3 py-3 text-center">
        {isWaiting && onToggleSelect ? (
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={() => onToggleSelect(cart.id)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        ) : (
          <span className="w-4 h-4 inline-block" />
        )}
      </td>
      {/* Cart number */}
      <td className="px-3 py-3 font-bold text-primary-700 dark:text-primary-400 text-center">
        #{cart.cart_number}
      </td>
      {/* Cart type */}
      <td className="px-3 py-3 text-center text-sm">
        {cart.cart_type} צוללנים
      </td>
      {/* Diver names */}
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {cart.diver_names.map((name, i) => (
            <span key={i} className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 px-1.5 py-0.5 rounded">
              {name}
            </span>
          ))}
        </div>
      </td>
      {/* Location */}
      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
        {cart.checkin_location || '—'}
      </td>
      {/* Status badge */}
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[liveStatus] || ''}`}>
          {STATUS_LABELS[liveStatus] || liveStatus}
        </span>
      </td>
      {/* Next deadline */}
      <td className="px-3 py-3 text-center font-mono text-sm">
        {!isWaiting && !isPaused && cart.next_deadline
          ? formatClockTime(cart.next_deadline)
          : '—'}
      </td>
      {/* Time remaining */}
      <td className="px-3 py-3 text-center font-mono font-bold text-sm">
        {isWaiting ? (
          <span className="text-gray-400">—</span>
        ) : isPaused ? (
          <span className="text-primary-600 dark:text-primary-400">מושהה</span>
        ) : (
          <span className={
            timer.status === 'expired' ? 'text-danger-600 dark:text-danger-400' :
            timer.status === 'orange' ? 'text-warning-600 dark:text-warning-400' :
            'text-success-600 dark:text-success-400'
          }>
            {timer.displayTime}
          </span>
        )}
      </td>
      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-[100px]">
            <CheckInButton
              cartId={cart.id}
              timerStatus={isWaiting ? 'waiting' : isPaused ? 'paused' : timer.status}
              isPaused={isPaused}
              isWaiting={isWaiting}
            />
          </div>
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showActions && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-10 min-w-[140px]">
                <button onClick={() => { onEditCart(cart); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg text-sm">
                  עריכה
                </button>
                <button onClick={() => { handleEnd(); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-warning-600 text-sm">
                  סיום פעילות
                </button>
                <button onClick={() => { handleDelete(); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-danger-600 rounded-b-lg text-sm">
                  מחיקה
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function CartTable({ carts, onEditCart, selectedCartIds, onToggleSelect }: CartTableProps) {
  if (carts.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-lg">אין עגלות פעילות</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">הוסף עגלה חדשה כדי להתחיל</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-right" dir="rtl">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            <th className="px-3 py-3 w-10"></th>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">סוג</th>
            <th className="px-3 py-3 font-medium">צוללנים</th>
            <th className="px-3 py-3 font-medium">מיקום</th>
            <th className="px-3 py-3 font-medium text-center">סטטוס</th>
            <th className="px-3 py-3 font-medium text-center">עגולה עד</th>
            <th className="px-3 py-3 font-medium text-center">זמן נותר</th>
            <th className="px-3 py-3 font-medium">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {carts.map((cart) => (
            <CartTableRow
              key={cart.id}
              cart={cart}
              onEditCart={onEditCart}
              isSelected={selectedCartIds?.has(cart.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
