import { useEmergencyScreenStore } from '../stores/emergencyScreenStore';

export default function EmergencyMiniBadge() {
  const { sessions, activeSessionId, expandSession } =
    useEmergencyScreenStore();

  const minimizedSessions = sessions.filter((s) => !s.resolved && s.minimized);

  // Don't show if no minimized sessions, or if an overlay is actively showing
  const activeSession = sessions.find(
    (s) => s.id === activeSessionId && !s.resolved && !s.minimized
  );
  if (minimizedSessions.length === 0 || activeSession) return null;

  const label =
    minimizedSessions.length === 1
      ? `חירום #${minimizedSessions[0].cartNumber}`
      : `חירום (${minimizedSessions.length})`;

  function handleClick() {
    expandSession(minimizedSessions[0].id);
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 left-4 z-[55] flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-full shadow-lg animate-flash transition-colors min-w-[48px] min-h-[48px]"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="font-bold text-lg">{label}</span>
    </button>
  );
}
