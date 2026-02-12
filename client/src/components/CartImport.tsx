import { useState, useRef } from 'react';
import { useCartStore } from '../stores/cartStore';
import type { CreateCartRequest } from '../types';

interface CartImportProps {
  onClose: () => void;
}

export default function CartImport({ onClose }: CartImportProps) {
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CreateCartRequest[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCarts = useCartStore((s) => s.importCarts);

  const parseCSV = (text: string): CreateCartRequest[] => {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    const carts: CreateCartRequest[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip header row if it looks like headers
      if (i === 0 && (line.includes('מספר') || line.toLowerCase().includes('cart') || line.toLowerCase().includes('number'))) {
        continue;
      }

      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) continue;

      const cartNumber = parseInt(parts[0]);
      if (isNaN(cartNumber)) continue;

      const diverNames = parts.slice(1).filter((n) => n);
      if (diverNames.length === 0) continue;

      const cartType = Math.min(8, Math.max(2, diverNames.length));
      carts.push({ cart_number: cartNumber, cart_type: cartType, diver_names: diverNames });
    }

    return carts;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      try {
        const parsed = parseCSV(text);
        setPreview(parsed);
        setError(parsed.length === 0 ? 'לא נמצאו עגלות בקובץ' : '');
      } catch {
        setError('שגיאה בקריאת הקובץ');
      }
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    try {
      const parsed = parseCSV(csvText);
      setPreview(parsed);
      setError(parsed.length === 0 ? 'לא נמצאו עגלות' : '');
    } catch {
      setError('שגיאה בפיענוח הנתונים');
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    try {
      const count = await importCarts(preview);
      alert(`יובאו ${count} עגלות בהצלחה`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בייבוא');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">ייבוא עגלות</h2>

        <div className="space-y-4">
          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full">
              בחר קובץ CSV
            </button>
          </div>

          <div className="text-center text-sm text-gray-500">או</div>

          {/* Manual paste */}
          <div>
            <label className="block text-sm font-medium mb-1">הדבק נתונים (CSV)</label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="מספר עגלה, שם צוללן 1, שם צוללן 2&#10;1, ישראל ישראלי, דוד כהן&#10;2, שרה לוי, רחל גולן"
              className="input-field h-32 resize-none font-mono text-sm"
              dir="ltr"
            />
            <button onClick={handleParse} className="btn-secondary text-sm mt-2">
              פענח נתונים
            </button>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">תצוגה מקדימה ({preview.length} עגלות):</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {preview.map((cart, i) => (
                  <div key={i} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded flex items-center gap-2">
                    <span className="font-bold">#{cart.cart_number}</span>
                    <span className="text-gray-500">|</span>
                    <span>{cart.diver_names.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-danger-600 text-sm bg-danger-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-secondary">ביטול</button>
            <button
              onClick={handleImport}
              disabled={loading || preview.length === 0}
              className="btn-primary"
            >
              {loading ? 'מייבא...' : `ייבא ${preview.length} עגלות`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
