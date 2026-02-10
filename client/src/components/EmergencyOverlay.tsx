import { useState, useRef, useEffect } from 'react';
import { useEmergencyScreenStore } from '../stores/emergencyScreenStore';
import { formatTime } from '../utils/time';

function ElapsedTime({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);

  return <span>{elapsed}</span>;
}

export default function EmergencyOverlay() {
  const {
    sessions,
    activeSessionId,
    toggleMinimize,
    expandSession,
    resolveEmergency,
    addChecklistItem,
    removeChecklistItem,
    toggleChecklistItem,
    loadChecklistFromFile,
  } = useEmergencyScreenStore();

  const [newItemText, setNewItemText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSessions = sessions.filter((s) => !s.resolved);
  const session = activeSessions.find((s) => s.id === activeSessionId);

  if (!session || session.minimized) return null;

  const completedCount = session.checklist.filter((i) => i.completed).length;
  const totalCount = session.checklist.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  function handleAddItem() {
    if (!newItemText.trim() || !session) return;
    addChecklistItem(session.id, newItemText.trim());
    setNewItemText('');
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      let items: string[] = [];

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            items = parsed.map(String);
          }
        } catch {
          // invalid JSON
        }
      } else {
        items = content.split('\n');
      }

      if (items.length > 0) {
        loadChecklistFromFile(session.id, items);
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be loaded again
    e.target.value = '';
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-900/95" dir="rtl">
      {/* Session Tabs */}
      {activeSessions.length > 1 && (
        <div className="flex gap-1 bg-gray-800 px-4 pt-2">
          {activeSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => expandSession(s.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                s.id === activeSessionId
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              עגולה #{s.cartNumber}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-red-700 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              חירום — עגולה #{session.cartNumber}
            </h1>
            <p className="text-red-100 text-sm mt-1">
              {session.diverNames.join(', ')}
            </p>
          </div>
          <div className="bg-red-900/50 px-4 py-2 rounded-lg text-center">
            <div className="text-xs text-red-200">זמן שעבר</div>
            <div className="text-xl font-mono font-bold">
              <ElapsedTime since={session.triggeredAt} />
            </div>
          </div>
        </div>
        <button
          onClick={() => toggleMinimize(session.id)}
          className="p-2 hover:bg-red-600 rounded-lg transition-colors"
          title="מזער"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Checklist Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-300 mb-1">
              <span>התקדמות</span>
              <span>{completedCount} / {totalCount}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Checklist Items */}
        <div className="space-y-2 mb-4">
          {session.checklist.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                item.completed
                  ? 'bg-green-900/30 border border-green-700/50'
                  : 'bg-gray-800 border border-gray-700'
              }`}
            >
              <button
                onClick={() => toggleChecklistItem(session.id, item.id)}
                className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  item.completed
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-500 hover:border-gray-300'
                }`}
              >
                {item.completed && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className="text-gray-400 text-sm font-mono w-6">{idx + 1}.</span>
              <span
                className={`flex-1 text-lg ${
                  item.completed ? 'text-gray-500 line-through' : 'text-white'
                }`}
              >
                {item.text}
              </span>
              {item.completed && item.completedAt && (
                <span className="text-green-400 text-sm font-mono">
                  {formatTime(item.completedAt)}
                </span>
              )}
              <button
                onClick={() => removeChecklistItem(session.id, item.id)}
                className="flex-shrink-0 p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="הסר פריט"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add Item Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="הוסף שלב חדש..."
            className="flex-1 bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 text-lg placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleAddItem}
            className="bg-red-700 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            הוסף
          </button>
        </div>

        {/* Load from File */}
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            טען מקובץ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.json"
            onChange={handleFileLoad}
            className="hidden"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <button
          onClick={() => resolveEmergency(session.id)}
          className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-bold text-lg transition-colors"
        >
          סיום חירום — סמן כטופל
        </button>
      </div>
    </div>
  );
}
