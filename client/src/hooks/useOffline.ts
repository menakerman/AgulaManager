import { useState, useEffect } from 'react';
import { getPendingActions, clearPendingActions } from '../services/db';
import { api } from '../services/api';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingActions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending actions count
    getPendingActions().then((actions) => setPendingCount(actions.length));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPendingActions = async () => {
    try {
      const actions = await getPendingActions();
      if (actions.length === 0) return;

      for (const action of actions) {
        try {
          switch (action.type) {
            case 'checkin':
              await api.checkIn(action.payload.id as number);
              break;
            case 'endCart':
              await api.endCart(action.payload.id as number);
              break;
            case 'resetTimer':
              await api.resetTimer(
                action.payload.id as number,
                { reason: action.payload.reason as string }
              );
              break;
          }
        } catch (err) {
          console.error('Failed to sync action:', action, err);
        }
      }

      await clearPendingActions();
      setPendingCount(0);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  return { isOnline, pendingCount, syncPendingActions };
}
