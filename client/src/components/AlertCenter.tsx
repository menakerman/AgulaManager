import { useEffect, useState } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { formatDateTime } from '../utils/time';

export default function AlertCenter() {
  const { alerts, events, showAlertCenter, setShowAlertCenter, dismissAlert, fetchEvents, resolveEvent, addEventNote } = useAlertStore();
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'alerts' | 'events'>('alerts');

  useEffect(() => {
    if (showAlertCenter) {
      fetchEvents();
    }
  }, [showAlertCenter, fetchEvents]);

  if (!showAlertCenter) return null;

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const openEvents = events.filter((e) => e.status === 'open');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAlertCenter(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-xl m-4 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">מרכז התראות</h2>
          <button onClick={() => setShowAlertCenter(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'alerts' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
          >
            התראות ({activeAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'events' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
          >
            אירועים פתוחים ({openEvents.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'alerts' ? (
            activeAlerts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">אין התראות פעילות</p>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg flex items-center justify-between ${
                    alert.type === 'emergency' ? 'bg-red-100 dark:bg-red-900/30' :
                    alert.type === 'overdue' ? 'bg-danger-50 dark:bg-red-900/20' :
                    'bg-warning-50 dark:bg-yellow-900/20'
                  }`}>
                    <div>
                      <span className="font-bold">עגלה #{alert.cart.cart_number}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                        {alert.type === 'emergency' ? 'חירום' : alert.type === 'overdue' ? 'חריגה' : 'אזהרה'}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {alert.cart.diver_names.join(', ')} - {formatDateTime(alert.timestamp)}
                      </div>
                    </div>
                    <button onClick={() => dismissAlert(alert.id)} className="btn-secondary text-sm py-1 px-3">
                      סגור
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            openEvents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">אין אירועים פתוחים</p>
            ) : (
              <div className="space-y-3">
                {openEvents.map((event) => (
                  <div key={event.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className={`text-sm font-bold px-2 py-1 rounded ${
                          event.event_type === 'emergency' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          event.event_type === 'overdue' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {event.event_type === 'emergency' ? 'חירום' : event.event_type === 'overdue' ? 'חריגה' : 'אזהרה'}
                        </span>
                        <span className="text-sm text-gray-500 mr-2">עגלה #{event.cart_id}</span>
                      </div>
                      <button onClick={() => resolveEvent(event.id)} className="btn-success text-sm py-1 px-3">
                        סגור אירוע
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{formatDateTime(event.opened_at)}</div>

                    {/* Notes */}
                    {event.notes.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {event.notes.map((note, i) => (
                          <div key={i} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            {note}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add note */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteInput[event.id] || ''}
                        onChange={(e) => setNoteInput({ ...noteInput, [event.id]: e.target.value })}
                        placeholder="הוסף הערה..."
                        className="input-field text-sm flex-1"
                      />
                      <button
                        onClick={() => {
                          if (noteInput[event.id]?.trim()) {
                            addEventNote(event.id, noteInput[event.id]);
                            setNoteInput({ ...noteInput, [event.id]: '' });
                          }
                        }}
                        className="btn-primary text-sm py-1 px-3"
                      >
                        הוסף
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
