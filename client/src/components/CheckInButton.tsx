import { useState } from 'react';
import { useCartStore } from '../stores/cartStore';

interface CheckInButtonProps {
  cartId: number;
  timerStatus: string;
  isPaused: boolean;
}

export default function CheckInButton({ cartId, timerStatus, isPaused }: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);
  const checkIn = useCartStore((s) => s.checkIn);
  const newRound = useCartStore((s) => s.newRound);

  const handlePress = async () => {
    setLoading(true);
    try {
      if (isPaused) {
        // Cart is paused -> start new round
        await newRound(cartId);
      } else {
        // Cart is running -> identify and pause
        await checkIn(cartId);
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
    setLoading(false);
  };

  const isUrgent = !isPaused && (timerStatus === 'orange' || timerStatus === 'expired');

  return (
    <button
      onClick={handlePress}
      disabled={loading}
      className={`w-full py-3 px-4 rounded-lg font-bold text-lg transition-all duration-200 ${
        isPaused
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
      ) : isPaused ? (
        'עגולה חדשה'
      ) : (
        'הזדהות'
      )}
    </button>
  );
}
