import { useState, useRef, useEffect } from 'react';
import { useCartStore } from '../stores/cartStore';

interface CheckInButtonProps {
  cartId: number;
  timerStatus: string;
  isPaused: boolean;
  isWaiting?: boolean;
}

export default function CheckInButton({ cartId, timerStatus, isPaused, isWaiting }: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const checkIn = useCartStore((s) => s.checkIn);
  const newRound = useCartStore((s) => s.newRound);
  const startTimers = useCartStore((s) => s.startTimers);

  useEffect(() => {
    if (showLocationInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showLocationInput]);

  const handlePress = async () => {
    if (isWaiting) {
      // Cart is waiting -> show location input for starting the timer
      setShowLocationInput(true);
    } else if (isPaused) {
      // Cart is paused -> start new round immediately
      setLoading(true);
      try {
        await newRound(cartId);
      } catch (err) {
        console.error('Action failed:', err);
      }
      setLoading(false);
    } else {
      // Cart is running -> show location input first
      setShowLocationInput(true);
    }
  };

  const handleConfirmCheckIn = async () => {
    setLoading(true);
    try {
      if (isWaiting) {
        await startTimers([cartId], location.trim() || undefined);
      } else {
        await checkIn(cartId, location.trim() ? { location: location.trim() } : undefined);
      }
      setLocation('');
      setShowLocationInput(false);
    } catch (err) {
      console.error('Action failed:', err);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setLocation('');
    setShowLocationInput(false);
  };

  const isUrgent = !isPaused && (timerStatus === 'orange' || timerStatus === 'expired');

  if (showLocationInput) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCheckIn();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder={isWaiting ? "מיקום (לא חובה)" : "מיקום הזדהות (לא חובה)"}
            className="input-field text-sm py-2 flex-1"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirmCheckIn}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-lg font-bold text-base bg-success-600 hover:bg-success-700 text-white transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                מעדכן...
              </span>
            ) : isWaiting ? (
              'התחל עגולה'
            ) : (
              'אישור הזדהות'
            )}
          </button>
          <button
            onClick={handleCancel}
            className="py-2.5 px-4 rounded-lg font-bold text-base btn-secondary"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handlePress}
      disabled={loading}
      className={`w-full py-3 px-4 rounded-lg font-bold text-lg transition-all duration-200 ${
        isWaiting
          ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
          : isPaused
            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
            : isUrgent
              ? 'bg-success-600 hover:bg-success-700 text-white shadow-lg hover:shadow-xl scale-105'
              : 'btn-success'
      } disabled:opacity-50`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          מעדכן...
        </span>
      ) : isWaiting ? (
        'התחל עגולה'
      ) : isPaused ? (
        'עגולה חדשה'
      ) : (
        'הזדהות'
      )}
    </button>
  );
}
