import { useState } from 'react';
import { useDiveStore } from '../stores/diveStore';
import { useCartStore } from '../stores/cartStore';
import type { TeamMember, TeamRole } from '../types';

const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: 'חובש', label: 'חובש' },
  { value: 'בקר', label: 'בקר' },
  { value: 'פקח צולל', label: 'פקח צולל' },
];

export default function DiveInfoBar() {
  const dive = useDiveStore((s) => s.dive);
  const endDive = useDiveStore((s) => s.endDive);
  const updateDive = useDiveStore((s) => s.updateDive);
  const fetchCarts = useCartStore((s) => s.fetchCarts);
  const [showEdit, setShowEdit] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [editManager, setEditManager] = useState('');
  const [editDiveName, setEditDiveName] = useState('');
  const [editMembers, setEditMembers] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);

  if (!dive) return null;

  const handleStartEdit = () => {
    setEditManager(dive.manager_name);
    setEditDiveName(dive.name || '');
    setEditMembers([...dive.team_members]);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await updateDive({
        manager_name: editManager.trim(),
        team_members: editMembers.filter((m) => m.name.trim()),
        name: editDiveName.trim() || undefined,
      });
      setShowEdit(false);
    } catch (err) {
      console.error('Failed to update dive:', err);
    }
    setSaving(false);
  };

  const handleEndDive = async () => {
    try {
      await endDive();
      fetchCarts();
    } catch (err) {
      console.error('Failed to end dive:', err);
    }
    setShowEndConfirm(false);
  };

  const addEditMember = () => {
    setEditMembers([...editMembers, { role: 'חובש', name: '' }]);
  };

  return (
    <>
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {dive.name && (
              <span className="font-semibold text-primary-700 dark:text-primary-300">
                {dive.name} |
              </span>
            )}
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              מנהל צלילה: {dive.manager_name}
            </span>
            {dive.team_members.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300"
              >
                {m.role}: {m.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStartEdit}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              עריכה
            </button>
            <button
              onClick={() => setShowEndConfirm(true)}
              className="bg-danger-600 hover:bg-danger-700 text-white text-sm py-1.5 px-3 rounded-lg transition-colors"
            >
              סיים צלילה
            </button>
          </div>
        </div>
      </div>

      {/* End Dive Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEndConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">סיום צלילה</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-5">
              האם לסיים את הצלילה? כל העגלות הפעילות יסתיימו.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEndConfirm(false)} className="btn-secondary">ביטול</button>
              <button onClick={handleEndDive} className="bg-danger-600 hover:bg-danger-700 text-white py-2 px-4 rounded-lg transition-colors">
                סיים צלילה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dive Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">עריכת צלילה</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">מנהל צלילה</label>
                <input
                  type="text"
                  value={editManager}
                  onChange={(e) => setEditManager(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">שם צלילה (אופציונלי)</label>
                <input
                  type="text"
                  value={editDiveName}
                  onChange={(e) => setEditDiveName(e.target.value)}
                  className="input-field"
                  placeholder="שם הצלילה"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">צוות</label>
                  <button
                    type="button"
                    onClick={addEditMember}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    + הוסף
                  </button>
                </div>
                <div className="space-y-2">
                  {editMembers.map((member, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const updated = [...editMembers];
                          updated[i] = { ...updated[i], role: e.target.value as TeamRole };
                          setEditMembers(updated);
                        }}
                        className="input-field w-36 shrink-0"
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => {
                          const updated = [...editMembers];
                          updated[i] = { ...updated[i], name: e.target.value };
                          setEditMembers(updated);
                        }}
                        className="input-field flex-1"
                        placeholder="שם"
                      />
                      <button
                        type="button"
                        onClick={() => setEditMembers(editMembers.filter((_, j) => j !== i))}
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
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowEdit(false)} className="btn-secondary">ביטול</button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary">
                  {saving ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
