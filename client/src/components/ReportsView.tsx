import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { formatDateTime, getTodayDate } from '../utils/time';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/export';

interface DailyReport {
  date: string;
  summary: {
    total_carts: number;
    active_carts: number;
    completed_carts: number;
    total_checkins: number;
    open_events: number;
    events_by_type: Record<string, number>;
  };
  carts: any[];
}

export default function ReportsView() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [date, setDate] = useState(getTodayDate());
  const [loading, setLoading] = useState(false);
  const carts = useCartStore((s) => s.carts);

  useEffect(() => {
    loadReport();
  }, [date]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getDailyReport(date);
      setReport(data);
    } catch (err) {
      console.error('Failed to load report:', err);
    }
    setLoading(false);
  };

  const handleExportCSV = () => exportToCSV(carts);
  const handleExportExcel = () => exportToExcel(carts);
  const handleExportPDF = () => exportToPDF(carts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold">דוחות</h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-auto"
          />
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleExportCSV} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV
        </button>
        <button onClick={handleExportExcel} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Excel
        </button>
        <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">טוען דוח...</div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-primary-600">{report.summary.total_carts}</div>
              <div className="text-sm text-gray-500 mt-1">סה"כ עגלות</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-success-600">{report.summary.active_carts}</div>
              <div className="text-sm text-gray-500 mt-1">פעילות</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-gray-600">{report.summary.completed_carts}</div>
              <div className="text-sm text-gray-500 mt-1">הושלמו</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-primary-600">{report.summary.total_checkins}</div>
              <div className="text-sm text-gray-500 mt-1">הזדהויות</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-danger-600">{report.summary.open_events}</div>
              <div className="text-sm text-gray-500 mt-1">אירועים פתוחים</div>
            </div>
          </div>

          {/* Events breakdown */}
          {Object.keys(report.summary.events_by_type).length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold mb-3">אירועים לפי סוג</h3>
              <div className="flex gap-4">
                {Object.entries(report.summary.events_by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      type === 'emergency' ? 'bg-red-500' :
                      type === 'overdue' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-sm">{type === 'emergency' ? 'חירום' : type === 'overdue' ? 'חריגה' : 'אזהרה'}: {count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carts table */}
          {report.carts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700">
                <h3 className="font-bold">פירוט עגלות</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right">#</th>
                      <th className="px-4 py-3 text-right">סוג</th>
                      <th className="px-4 py-3 text-right">צוללנים</th>
                      <th className="px-4 py-3 text-right">סטטוס</th>
                      <th className="px-4 py-3 text-right">התחלה</th>
                      <th className="px-4 py-3 text-right">הזדהויות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {report.carts.map((cart: any) => (
                      <tr key={cart.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-bold">{cart.cart_number}</td>
                        <td className="px-4 py-3">{cart.cart_type}</td>
                        <td className="px-4 py-3">{Array.isArray(cart.diver_names) ? cart.diver_names.join(', ') : cart.diver_names}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            cart.status === 'active' ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {cart.status === 'active' ? 'פעיל' : 'הושלם'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDateTime(cart.started_at)}</td>
                        <td className="px-4 py-3">{cart.checkin_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">אין נתונים לתאריך זה</div>
      )}
    </div>
  );
}
