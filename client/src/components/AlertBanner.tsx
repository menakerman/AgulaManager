import { useEffect } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { useAudio } from '../hooks/useAudio';

export default function AlertBanner() {
  const alerts = useAlertStore((s) => s.alerts);
  const dismissAlert = useAlertStore((s) => s.dismissAlert);
  const setShowAlertCenter = useAlertStore((s) => s.setShowAlertCenter);
  const { playAlert } = useAudio();

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const latestAlert = activeAlerts[0];

  // Play sound on new alert
  useEffect(() => {
    if (latestAlert) {
      playAlert(latestAlert.type);
    }
  }, [latestAlert?.id]);

  if (!latestAlert) return null;

  const styles = {
    warning: 'bg-warning-500 text-white',
    overdue: 'bg-danger-500 text-white animate-pulse',
    emergency: 'bg-red-700 text-white animate-flash',
  };

  const labels = {
    warning: 'אזהרה',
    overdue: 'חריגת זמן',
    emergency: 'חירום',
  };

  return (
    <div className={`${styles[latestAlert.type]} px-4 py-3 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          {latestAlert.type === 'emergency' ? '🚨' : latestAlert.type === 'overdue' ? '⚠️' : '⏰'}
        </span>
        <div>
          <span className="font-bold">{labels[latestAlert.type]}: </span>
          <span>עגלה #{latestAlert.cart.cart_number} - {latestAlert.cart.diver_names.join(', ')}</span>
        </div>
        {activeAlerts.length > 1 && (
          <button
            onClick={() => setShowAlertCenter(true)}
            className="bg-white/20 px-3 py-1 rounded-full text-sm"
          >
            +{activeAlerts.length - 1} נוספים
          </button>
        )}
      </div>
      <button
        onClick={() => dismissAlert(latestAlert.id)}
        className="p-1 hover:bg-white/20 rounded"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
