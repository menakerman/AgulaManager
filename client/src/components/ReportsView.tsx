import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/time';
import { exportDiveToCSV, exportDiveToExcel, exportDiveToPDF } from '../utils/export';
import type { DiveReportSummary, DiveReportDetail } from '../types';

type Tab = 'timeline' | 'carts' | 'events';

export default function ReportsView() {
  const [diveReports, setDiveReports] = useState<DiveReportSummary[]>([]);
  const [selectedDiveId, setSelectedDiveId] = useState<number | null>(null);
  const [diveDetail, setDiveDetail] = useState<DiveReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  useEffect(() => {
    loadDiveReports();
  }, []);

  useEffect(() => {
    if (selectedDiveId !== null) {
      loadDiveDetail(selectedDiveId);
    }
  }, [selectedDiveId]);

  const loadDiveReports = async () => {
    setLoading(true);
    try {
      const data = await api.getDiveReports();
      setDiveReports(data);
    } catch (err) {
      console.error('Failed to load dive reports:', err);
    }
    setLoading(false);
  };

  const loadDiveDetail = async (id: number) => {
    setLoading(true);
    try {
      const data = await api.getDiveReport(id);
      setDiveDetail(data);
    } catch (err) {
      console.error('Failed to load dive detail:', err);
    }
    setLoading(false);
  };

  const handleBack = () => {
    setSelectedDiveId(null);
    setDiveDetail(null);
    setActiveTab('timeline');
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return 'פעילה';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h} שעות ${m > 0 ? `ו-${m} דקות` : ''}`;
    return `${m} דקות`;
  };

  // --- View B: Dive Detail ---
  if (selectedDiveId !== null && diveDetail) {
    const { dive, summary, carts, events, timeline } = diveDetail;
    const diveName = dive.name || `צלילה ${formatDateTime(dive.started_at).split(' ')[0]}`;
    const isCompleted = dive.status === 'completed';

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 text-sm"
        >
          <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          חזרה לרשימת דוחות
        </button>

        {/* Header card */}
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold">{diveName}</h2>
                {isCompleted ? (
                  <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    נחתם &#10003;
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 animate-pulse">
                    פעילה
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <div>מנהל: {dive.manager_name}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  {dive.team_members.map((m, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    >
                      {m.role}: {m.name}
                    </span>
                  ))}
                </div>
                <div>
                  התחלה: {formatDateTime(dive.started_at)}
                  {dive.ended_at && <> | סיום: {formatDateTime(dive.ended_at)}</>}
                  {' | '}משך: {formatDuration(summary.duration_minutes)}
                </div>
              </div>
            </div>

            {/* Export buttons (only for completed dives) */}
            {isCompleted && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => exportDiveToCSV(diveDetail)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <DownloadIcon /> CSV
                </button>
                <button
                  onClick={() => exportDiveToExcel(diveDetail)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <DownloadIcon /> Excel
                </button>
                <button
                  onClick={() => exportDiveToPDF(diveDetail)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <DownloadIcon /> PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">{summary.cart_count}</div>
            <div className="text-sm text-gray-500 mt-1">עגלות</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{summary.checkin_count}</div>
            <div className="text-sm text-gray-500 mt-1">הזדהויות</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold text-danger-600">{summary.event_count}</div>
            <div className="text-sm text-gray-500 mt-1">אירועים</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500 mb-1">אירועים לפי סוג</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {Object.entries(summary.events_by_type).map(([type, count]) => (
                <span key={type} className="flex items-center gap-1 text-xs">
                  <span className={`w-2 h-2 rounded-full ${
                    type === 'emergency' ? 'bg-red-500' :
                    type === 'overdue' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  {type === 'emergency' ? 'חירום' : type === 'overdue' ? 'חריגה' : 'אזהרה'}: {count}
                </span>
              ))}
              {Object.keys(summary.events_by_type).length === 0 && (
                <span className="text-xs text-gray-400">אין אירועים</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b dark:border-gray-700">
          <div className="flex gap-0">
            {([
              { key: 'timeline' as Tab, label: 'ציר זמן' },
              { key: 'carts' as Tab, label: 'עגלות' },
              { key: 'events' as Tab, label: 'אירועים' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'timeline' && (
          <div className="card p-4">
            {timeline.length === 0 ? (
              <div className="text-center py-6 text-gray-500">אין אירועים בציר הזמן</div>
            ) : (
              <div className="space-y-0">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3 items-start py-2">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${timelineDotColor(entry.type)}`} />
                      {i < timeline.length - 1 && (
                        <div className="w-0.5 bg-gray-200 dark:bg-gray-700 flex-1 min-h-[16px]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="text-sm">{entry.description}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(entry.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'carts' && (
          <div className="card overflow-hidden">
            {carts.length === 0 ? (
              <div className="text-center py-6 text-gray-500">אין עגלות בצלילה זו</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right">#</th>
                      <th className="px-4 py-3 text-right">סוג</th>
                      <th className="px-4 py-3 text-right">צוללנים</th>
                      <th className="px-4 py-3 text-right">סטטוס</th>
                      <th className="px-4 py-3 text-right">התחלה</th>
                      <th className="px-4 py-3 text-right">סיום</th>
                      <th className="px-4 py-3 text-right">הזדהויות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {carts.map((cart) => (
                      <tr key={cart.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-bold">{cart.cart_number}</td>
                        <td className="px-4 py-3">{cart.cart_type}</td>
                        <td className="px-4 py-3">{cart.diver_names.join(', ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            cart.status === 'active'
                              ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}>
                            {cart.status === 'active' ? 'פעיל' : 'הושלם'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDateTime(cart.started_at)}</td>
                        <td className="px-4 py-3 text-gray-500">{cart.ended_at ? formatDateTime(cart.ended_at) : '-'}</td>
                        <td className="px-4 py-3">{cart.checkin_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="card overflow-hidden">
            {events.length === 0 ? (
              <div className="text-center py-6 text-gray-500">אין אירועים בצלילה זו</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right">סוג</th>
                      <th className="px-4 py-3 text-right">עגלה</th>
                      <th className="px-4 py-3 text-right">סטטוס</th>
                      <th className="px-4 py-3 text-right">נפתח</th>
                      <th className="px-4 py-3 text-right">נסגר</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              event.event_type === 'emergency' ? 'bg-red-500' :
                              event.event_type === 'overdue' ? 'bg-orange-500' : 'bg-yellow-500'
                            }`} />
                            {event.event_type === 'emergency' ? 'חירום' :
                             event.event_type === 'overdue' ? 'חריגה' : 'אזהרה'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">{event.cart_number}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            event.status === 'open'
                              ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                              : 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                          }`}>
                            {event.status === 'open' ? 'פתוח' : 'נסגר'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDateTime(event.opened_at)}</td>
                        <td className="px-4 py-3 text-gray-500">{event.resolved_at ? formatDateTime(event.resolved_at) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- View A: Dive List ---
  // Sort: active dives first, then by started_at desc
  const sortedReports = [...diveReports].sort((a, b) => {
    if (a.dive.status === 'active' && b.dive.status !== 'active') return -1;
    if (b.dive.status === 'active' && a.dive.status !== 'active') return 1;
    return new Date(b.dive.started_at).getTime() - new Date(a.dive.started_at).getTime();
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">דוחות צלילה</h2>

      {loading ? (
        <div className="text-center py-8 text-gray-500">טוען דוחות...</div>
      ) : sortedReports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>אין צלילות עדיין</div>
          <div className="text-sm mt-1">דוחות יופיעו כאן לאחר תחילת הצלילה הראשונה</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedReports.map((report) => {
            const isActive = report.dive.status === 'active';
            const diveName = report.dive.name || `צלילה ${formatDateTime(report.dive.started_at).split(' ')[0]}`;
            return (
              <button
                key={report.dive.id}
                onClick={() => setSelectedDiveId(report.dive.id)}
                className={`card p-4 w-full text-right hover:shadow-md transition-shadow cursor-pointer ${
                  isActive ? 'border-2 border-primary-500 dark:border-primary-400' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base">{diveName}</span>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 animate-pulse">
                          פעילה
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          נחתם &#10003;
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {report.dive.manager_name} | {formatDuration(report.duration_minutes)}
                    </div>
                  </div>
                  <div className="flex gap-4 text-center flex-shrink-0">
                    <div>
                      <div className="text-lg font-bold text-primary-600">{report.cart_count}</div>
                      <div className="text-xs text-gray-500">עגלות</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{report.checkin_count}</div>
                      <div className="text-xs text-gray-500">הזדהויות</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-danger-600">{report.event_count}</div>
                      <div className="text-xs text-gray-500">אירועים</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function timelineDotColor(type: string): string {
  switch (type) {
    case 'dive_start': return 'bg-green-500';
    case 'dive_end': return 'bg-gray-500';
    case 'cart_start': return 'bg-blue-500';
    case 'cart_end': return 'bg-blue-300';
    case 'checkin': return 'bg-primary-500';
    case 'event_open': return 'bg-red-500';
    case 'event_resolve': return 'bg-green-400';
    default: return 'bg-gray-400';
  }
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'פעילה';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} שעות${m > 0 ? ` ו-${m} דקות` : ''}`;
  return `${m} דקות`;
}
