import { useState, useEffect } from 'react';
import type { CartWithTimer, CartType } from '../types';
import { useCartStore } from '../stores/cartStore';
import { useDiveStore } from '../stores/diveStore';

interface CartFormProps {
  editCart?: CartWithTimer | null;
  onClose: () => void;
}

export default function CartForm({ editCart, onClose }: CartFormProps) {
  const { carts, createCart, editCart: updateCart } = useCartStore();
  const dive = useDiveStore((s) => s.dive);

  // Auto-increment: next number is max existing + 1, or 1 if no carts
  const nextCartNumber = carts.length > 0
    ? Math.max(...carts.map((c) => c.cart_number)) + 1
    : 1;

  const [cartNumber, setCartNumber] = useState('');
  const [cartType, setCartType] = useState<CartType>('pair');
  const [diverNames, setDiverNames] = useState<string[]>(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editCart) {
      setCartNumber(String(editCart.cart_number));
      setCartType(editCart.cart_type);
      setDiverNames(editCart.diver_names);
    } else {
      setCartNumber(String(nextCartNumber));
    }
  }, [editCart, nextCartNumber]);

  const diverCount = { pair: 2, trio: 3, six: 6 }[cartType];

  useEffect(() => {
    setDiverNames((prev) => {
      const newNames = [...prev];
      while (newNames.length < diverCount) newNames.push('');
      return newNames.slice(0, diverCount);
    });
  }, [cartType, diverCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const num = parseInt(cartNumber);
    if (!num || num < 1) {
      setError('מספר עגלה לא תקין');
      return;
    }

    const names = diverNames.filter((n) => n.trim());
    if (names.length === 0) {
      setError('יש להזין לפחות שם צוללן אחד');
      return;
    }

    setLoading(true);
    try {
      if (editCart) {
        await updateCart(editCart.id, { cart_number: num, cart_type: cartType, diver_names: names });
      } else {
        await createCart({ cart_number: num, cart_type: cartType, diver_names: names, dive_id: dive?.id });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת עגלה');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 m-4 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">
          {editCart ? `עריכת עגלה #${editCart.cart_number}` : 'עגלה חדשה'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">מספר עגלה</label>
            <input
              type="number"
              value={cartNumber}
              onChange={(e) => setCartNumber(e.target.value)}
              className="input-field"
              min="1"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">סוג</label>
            <div className="flex gap-2">
              {([['pair', 'זוג (2)'], ['trio', 'שלישייה (3)'], ['six', 'שישייה (6)']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCartType(value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    cartType === value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">שמות צוללנים</label>
            <div className="space-y-2">
              {diverNames.map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const newNames = [...diverNames];
                    newNames[i] = e.target.value;
                    setDiverNames(newNames);
                  }}
                  placeholder={`צוללן ${i + 1}`}
                  className="input-field"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-danger-600 text-sm bg-danger-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'שומר...' : editCart ? 'עדכן' : 'הוסף עגלה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
