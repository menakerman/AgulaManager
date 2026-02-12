import { useState, useRef } from 'react';
import { useDiveStore } from '../stores/diveStore';
import type { TeamMember, TeamRole, DiveSettings } from '../types';
import { DEFAULT_DIVE_SETTINGS } from '../types';

const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: 'חובש', label: 'חובש' },
  { value: 'בקר', label: 'בקר' },
  { value: 'פקח צולל', label: 'פקח צולל' },
];

export default function DiveGate() {
  const startDive = useDiveStore((s) => s.startDive);
  const [managerName, setManagerName] = useState('');
  const [diveName, setDiveName] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [agulaPeriod, setAgulaPeriod] = useState(DEFAULT_DIVE_SETTINGS.agula_period_minutes);
  const [warningMinutes, setWarningMinutes] = useState(DEFAULT_DIVE_SETTINGS.warning_minutes);
  const [overdueChecklist, setOverdueChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const checklistFileRef = useRef<HTMLInputElement>(null);

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { role: 'חובש', name: '' }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: 'role' | 'name', value: string) => {
    const updated = [...teamMembers];
    if (field === 'role') {
      updated[index] = { ...updated[index], role: value as TeamRole };
    } else {
      updated[index] = { ...updated[index], name: value };
    }
    setTeamMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!managerName.trim()) {
      setError('יש להזין שם מנהל צלילה');
      return;
    }

    // Filter out team members with empty names
    const validMembers = teamMembers.filter((m) => m.name.trim());

    setLoading(true);
    try {
      const settings: DiveSettings = {
        agula_period_minutes: agulaPeriod,
        warning_minutes: warningMinutes,
        overdue_checklist: overdueChecklist,
      };
      await startDive({
        manager_name: managerName.trim(),
        team_members: validMembers,
        name: diveName.trim() || undefined,
        settings,
      });
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחלת צלילה');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 m-4 max-w-lg w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤿</div>
          <h1 className="text-2xl font-bold mb-2">התחלת צלילה</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            יש להזין מנהל צלילה ולהזין עגלות לפני התחלת הצלילה
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">
              מנהל צלילה <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="input-field"
              placeholder="שם מנהל הצלילה"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">שם צלילה (אופציונלי)</label>
            <input
              type="text"
              value={diveName}
              onChange={(e) => setDiveName(e.target.value)}
              className="input-field"
              placeholder="שם הצלילה"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">צוות (אופציונלי)</label>
              <button
                type="button"
                onClick={addTeamMember}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                + הוסף איש צוות
              </button>
            </div>

            {teamMembers.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                לחץ "הוסף איש צוות" להוספת חובש, בקר או פקח צולל
              </p>
            )}

            <div className="space-y-3">
              {teamMembers.map((member, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={member.role}
                    onChange={(e) => updateTeamMember(i, 'role', e.target.value)}
                    className="input-field w-36 shrink-0"
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateTeamMember(i, 'name', e.target.value)}
                    className="input-field flex-1"
                    placeholder="שם"
                  />
                  <button
                    type="button"
                    onClick={() => removeTeamMember(i)}
                    className="p-2 text-gray-400 hover:text-danger-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dive Settings Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                הגדרות צלילה
              </span>
              <svg className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSettings && (
              <div className="p-4 space-y-4">
                {/* Agula Period */}
                <div>
                  <label className="block text-sm font-medium mb-2">משך עגולה (דקות)</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAgulaPeriod(Math.max(15, agulaPeriod - 5))}
                      className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={agulaPeriod}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 15 && v <= 120) setAgulaPeriod(v);
                      }}
                      min={15}
                      max={120}
                      step={5}
                      className="input-field w-24 text-center font-mono text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setAgulaPeriod(Math.min(120, agulaPeriod + 5))}
                      className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      ({agulaPeriod === 60 ? 'ברירת מחדל' : `${agulaPeriod} דקות`})
                    </span>
                  </div>
                </div>

                {/* Warning Time */}
                <div>
                  <label className="block text-sm font-medium mb-2">התראה לפני סיום (דקות)</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWarningMinutes(Math.max(1, warningMinutes - 1))}
                      className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={warningMinutes}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1 && v <= 30) setWarningMinutes(v);
                      }}
                      min={1}
                      max={30}
                      step={1}
                      className="input-field w-24 text-center font-mono text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setWarningMinutes(Math.min(30, warningMinutes + 1))}
                      className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      ({warningMinutes === 5 ? 'ברירת מחדל' : `${warningMinutes} דקות`})
                    </span>
                  </div>
                </div>

                {/* Overdue Checklist */}
                <div>
                  <label className="block text-sm font-medium mb-2">רשימת פעולות חירום</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    פעולות שיופיעו אוטומטית כשעגלה חורגת מהזמן
                  </p>

                  {overdueChecklist.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {overdueChecklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                          <span className="text-sm flex-1">{item}</span>
                          <button
                            type="button"
                            onClick={() => setOverdueChecklist(overdueChecklist.filter((_, idx) => idx !== i))}
                            className="p-1 text-gray-400 hover:text-danger-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newChecklistItem.trim()) {
                            setOverdueChecklist([...overdueChecklist, newChecklistItem.trim()]);
                            setNewChecklistItem('');
                          }
                        }
                      }}
                      placeholder="הוסף פעולה..."
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newChecklistItem.trim()) {
                          setOverdueChecklist([...overdueChecklist, newChecklistItem.trim()]);
                          setNewChecklistItem('');
                        }
                      }}
                      className="btn-secondary text-sm px-3"
                    >
                      הוסף
                    </button>
                  </div>

                  <input
                    ref={checklistFileRef}
                    type="file"
                    accept=".txt,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        try {
                          // Try JSON first
                          const parsed = JSON.parse(text);
                          const items = Array.isArray(parsed) ? parsed.map(String) : [];
                          setOverdueChecklist([...overdueChecklist, ...items.filter((t: string) => t.trim())]);
                        } catch {
                          // Fall back to line-separated text
                          const lines = text.split('\n').filter((l) => l.trim());
                          setOverdueChecklist([...overdueChecklist, ...lines]);
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => checklistFileRef.current?.click()}
                    className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    טען מקובץ (.txt / .json)
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-danger-600 text-sm bg-danger-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-lg"
          >
            {loading ? 'מתחיל צלילה...' : 'התחל צלילה'}
          </button>
        </form>
      </div>
    </div>
  );
}
