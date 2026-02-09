import { useEffect, useState } from 'react';
import type { Protocol } from '../types';
import { api } from '../services/api';

export default function EmergencyPanel() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = async () => {
    try {
      const data = await api.getProtocols();
      setProtocols(data);
    } catch (err) {
      console.error('Failed to load protocols:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    try {
      const protocol = await api.createProtocol({ title, content });
      setProtocols([...protocols, protocol]);
      setTitle('');
      setContent('');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to create protocol:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">נהלי חירום</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          {showForm ? 'ביטול' : 'הוסף נוהל'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הנוהל"
            className="input-field"
            required
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="תוכן הנוהל..."
            className="input-field h-32 resize-none"
            required
          />
          <button type="submit" className="btn-primary">שמור נוהל</button>
        </form>
      )}

      {protocols.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>אין נהלי חירום מוגדרים</p>
          <p className="text-sm mt-1">הוסף נהלי חירום כדי שיהיו זמינים במהלך הפעילות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {protocols.map((protocol) => (
            <div key={protocol.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === protocol.id ? null : protocol.id)}
                className="w-full p-4 text-right flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span className="font-bold text-lg">{protocol.title}</span>
                <svg
                  className={`w-5 h-5 transition-transform ${expandedId === protocol.id ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedId === protocol.id && (
                <div className="px-4 pb-4 border-t dark:border-gray-700 pt-3">
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {protocol.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
