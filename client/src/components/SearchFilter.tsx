import { useCartStore } from '../stores/cartStore';

export default function SearchFilter() {
  const { searchQuery, filterStatus, setSearchQuery, setFilterStatus } = useCartStore();

  const filters = [
    { value: 'all' as const, label: 'הכל', color: 'bg-gray-200 dark:bg-gray-700' },
    { value: 'waiting' as const, label: 'ממתין', color: 'bg-gray-500' },
    { value: 'green' as const, label: 'תקין', color: 'bg-success-500' },
    { value: 'orange' as const, label: 'אזהרה', color: 'bg-warning-500' },
    { value: 'expired' as const, label: 'פג', color: 'bg-danger-500' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div className="relative flex-1">
        <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="חיפוש לפי מספר עגלה או שם צוללן..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pr-10"
        />
      </div>
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              filterStatus === f.value
                ? `${f.color} text-white shadow-md`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
