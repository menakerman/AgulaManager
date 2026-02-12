import { useState, useEffect, useRef, useCallback } from 'react';
import type { CartWithTimer } from '../types';
import { roundToNearest5Minutes } from '../types';
import { useTimer } from '../hooks/useTimer';
import { useCartStore } from '../stores/cartStore';
import CheckInButton from './CheckInButton';
import { formatTime, formatClockTime } from '../utils/time';

interface CartCardProps {
  cart: CartWithTimer;
  onEdit: (cart: CartWithTimer) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

// Compute the rounded start time if a new round were started right now
function getProjectedStartTime(): string {
  return roundToNearest5Minutes(new Date()).toISOString();
}

export default function CartCard({ cart, onEdit, isSelected, onToggleSelect }: CartCardProps) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationModalValue, setLocationModalValue] = useState('');
  const [showPostStartLocation, setShowPostStartLocation] = useState(false);
  const [postStartLocation, setPostStartLocation] = useState('');
  const [postStartCountdown, setPostStartCountdown] = useState(30);
  const postStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postStartInputRef = useRef<HTMLInputElement>(null);
  const isWaiting = cart.timer_status === 'waiting';
  const isPaused = cart.timer_status === 'paused';
  const timer = useTimer(isPaused || isWaiting ? null : cart.next_deadline);
  const { endCart, resetTimer, deleteCart, updateLocation } = useCartStore();

  // Live projected start time while paused - updates every second
  const [projectedStartTime, setProjectedStartTime] = useState(getProjectedStartTime);
  useEffect(() => {
    if (!isPaused) return;
    setProjectedStartTime(getProjectedStartTime());
    const interval = setInterval(() => {
      setProjectedStartTime(getProjectedStartTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Clean up post-start interval on unmount
  useEffect(() => {
    return () => {
      if (postStartIntervalRef.current) {
        clearInterval(postStartIntervalRef.current);
      }
    };
  }, []);

  // Focus the post-start location input when it appears
  useEffect(() => {
    if (showPostStartLocation && postStartInputRef.current) {
      postStartInputRef.current.focus();
    }
  }, [showPostStartLocation]);

  const dismissPostStartLocation = useCallback(async () => {
    if (postStartIntervalRef.current) {
      clearInterval(postStartIntervalRef.current);
      postStartIntervalRef.current = null;
    }
    // Auto-save if location was typed
    if (postStartLocation.trim()) {
      try {
        await updateLocation(cart.id, postStartLocation.trim());
      } catch (err) {
        console.error('Failed to save location:', err);
      }
    }
    setShowPostStartLocation(false);
    setPostStartLocation('');
    setPostStartCountdown(30);
  }, [postStartLocation, cart.id, updateLocation]);

  const handleTimerStarted = useCallback(() => {
    setShowPostStartLocation(true);
    setPostStartCountdown(30);
    setPostStartLocation('');

    if (postStartIntervalRef.current) {
      clearInterval(postStartIntervalRef.current);
    }

    let count = 30;
    postStartIntervalRef.current = setInterval(() => {
      count -= 1;
      setPostStartCountdown(count);
      if (count <= 0) {
        // Will be handled by the effect below
        clearInterval(postStartIntervalRef.current!);
        postStartIntervalRef.current = null;
      }
    }, 1000);
  }, []);

  // Auto-dismiss when countdown hits 0
  useEffect(() => {
    if (showPostStartLocation && postStartCountdown <= 0) {
      dismissPostStartLocation();
    }
  }, [postStartCountdown, showPostStartLocation, dismissPostStartLocation]);

  const handlePostStartSubmit = async () => {
    if (postStartIntervalRef.current) {
      clearInterval(postStartIntervalRef.current);
      postStartIntervalRef.current = null;
    }
    if (postStartLocation.trim()) {
      try {
        await updateLocation(cart.id, postStartLocation.trim());
      } catch (err) {
        console.error('Failed to save location:', err);
      }
    }
    setShowPostStartLocation(false);
    setPostStartLocation('');
    setPostStartCountdown(30);
  };

  const timerClass = isWaiting
    ? 'timer-waiting'
    : isPaused
      ? 'bg-primary-50 dark:bg-blue-900/30 border-primary-500'
      : ({
          waiting: 'timer-waiting',
          green: 'timer-green',
          orange: 'timer-orange',
          expired: 'timer-red',
          red: 'timer-red',
          paused: '',
        } as Record<string, string>)[timer.status];

  const cartTypeLabel = `${cart.cart_type} צוללנים`;

  const handleReset = async () => {
    if (!resetReason.trim()) return;
    await resetTimer(cart.id, { reason: resetReason });
    setResetReason('');
    setShowResetModal(false);
  };

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

  const handleLocationModalSave = async () => {
    if (!locationModalValue.trim()) return;
    try {
      await updateLocation(cart.id, locationModalValue.trim());
    } catch (err) {
      console.error('Failed to update location:', err);
    }
    setLocationModalValue('');
    setShowLocationModal(false);
  };

  return (
    <div className={`card border-2 ${timerClass} overflow-hidden relative`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          {isWaiting && onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => onToggleSelect(cart.id)}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
          )}
          <div className="text-2xl font-bold text-primary-700 dark:text-primary-400">
            #{cart.cart_number}
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700">
            {cartTypeLabel}
          </span>
          {isWaiting && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold">
              ממתין
            </span>
          )}
          {isPaused && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
              מושהה
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showActions && (
            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-10 min-w-[140px]">
              <button onClick={() => { onEdit(cart); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg">
                עריכה
              </button>
              {!isWaiting && (
                <button onClick={() => { setShowLocationModal(true); setLocationModalValue(cart.checkin_location || ''); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                  עדכן מיקום
                </button>
              )}
              {!isWaiting && (
                <button onClick={() => { setShowResetModal(true); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                  איפוס טיימר
                </button>
              )}
              <button onClick={() => { handleEnd(); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-warning-600">
                סיום פעילות
              </button>
              <button onClick={() => { handleDelete(); setShowActions(false); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-danger-600 rounded-b-lg">
                מחיקה
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Divers */}
      <div className="px-4 pb-2">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">צוללנים:</div>
        <div className="flex flex-wrap gap-1">
          {cart.diver_names.map((name, i) => (
            <span key={i} className="text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 px-2 py-0.5 rounded">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Check-in Location */}
      {cart.checkin_location && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{cart.checkin_location}</span>
          </div>
        </div>
      )}

      {/* Agula schedule - when given & when it ends */}
      {!isPaused && !isWaiting && cart.next_deadline && (
        <div className="px-4 py-2">
          <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            <div className="text-center flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">ניתנה</div>
              <div className="text-lg font-bold font-mono">
                {cart.last_checkin ? formatClockTime(cart.last_checkin) : formatClockTime(cart.started_at)}
              </div>
            </div>
            <div className="text-gray-300 dark:text-gray-600 text-xl px-2">&rarr;</div>
            <div className="text-center flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">עגולה עד</div>
              <div className="text-2xl font-black font-mono text-primary-700 dark:text-primary-400">
                {formatClockTime(cart.next_deadline)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="px-4 py-2">
        {isWaiting ? (
          /* Waiting state: show dashed gray box */
          <div className="text-center py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-lg font-bold text-gray-400 dark:text-gray-500">
              ממתין להתחלה
            </div>
          </div>
        ) : isPaused ? (
          /* Paused state: show projected next deadline */
          <div className="text-center py-4 rounded-xl border-2 bg-primary-50 dark:bg-blue-900/30 border-primary-500">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">שעת תחילת עגולה:</div>
            <div className="text-5xl font-black font-mono text-primary-700 dark:text-primary-400">
              {formatClockTime(projectedStartTime)}
            </div>
            <div className="text-sm mt-2 text-gray-500 dark:text-gray-400">
              לחץ ״עגולה חדשה״ לאישור
            </div>
          </div>
        ) : (
          /* Active state: countdown timer */
          <>
            <div className={`text-center py-3 rounded-xl border-2 ${timerClass}`}>
              <div className="text-3xl font-mono font-bold tracking-wider">
                {timer.displayTime}
              </div>
              <div className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                {timer.status === 'expired' ? 'חריגה!' : 'זמן נותר'}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timer.status === 'green' ? 'bg-success-500' :
                  timer.status === 'orange' ? 'bg-warning-500' :
                  'bg-danger-500'
                }`}
                style={{ width: `${timer.percentRemaining}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Post-start location input with countdown */}
      {showPostStartLocation && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              ref={postStartInputRef}
              type="text"
              value={postStartLocation}
              onChange={(e) => setPostStartLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePostStartSubmit();
              }}
              placeholder="מיקום (לא חובה)"
              className="input-field text-sm py-1.5 flex-1"
              dir="rtl"
            />
            <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 min-w-[28px] text-center">
              {postStartCountdown}s
            </span>
            <button
              onClick={handlePostStartSubmit}
              className="py-1.5 px-3 rounded-lg text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white transition-all"
            >
              שמור
            </button>
          </div>
        </div>
      )}

      {/* Last identification */}
      {cart.last_checkin && (
        <div className="px-4 pb-1 text-xs text-gray-500 dark:text-gray-400">
          הזדהות אחרונה: {formatTime(cart.last_checkin)}
        </div>
      )}

      {/* Action button */}
      <div className="p-4 pt-2">
        <CheckInButton
          cartId={cart.id}
          timerStatus={isWaiting ? 'waiting' : isPaused ? 'paused' : timer.status}
          isPaused={isPaused}
          isWaiting={isWaiting}
          onTimerStarted={handleTimerStarted}
        />
      </div>

      {/* Reset Timer Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowResetModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">איפוס טיימר - עגלה #{cart.cart_number}</h3>
            <textarea
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              placeholder="סיבת האיפוס..."
              className="input-field mb-4 h-24 resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowResetModal(false)} className="btn-secondary">ביטול</button>
              <button onClick={handleReset} disabled={!resetReason.trim()} className="btn-primary">אפס טיימר</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLocationModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">עדכן מיקום - עגלה #{cart.cart_number}</h3>
            <input
              type="text"
              value={locationModalValue}
              onChange={(e) => setLocationModalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLocationModalSave();
              }}
              placeholder="מיקום"
              className="input-field mb-4"
              dir="rtl"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLocationModal(false)} className="btn-secondary">ביטול</button>
              <button onClick={handleLocationModalSave} disabled={!locationModalValue.trim()} className="btn-primary">שמור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
