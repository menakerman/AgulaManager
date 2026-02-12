import { useState } from 'react';
import { useDiveStore } from '../stores/diveStore';
import type { TeamMember, TeamRole } from '../types';

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
      await startDive({
        manager_name: managerName.trim(),
        team_members: validMembers,
        name: diveName.trim() || undefined,
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
