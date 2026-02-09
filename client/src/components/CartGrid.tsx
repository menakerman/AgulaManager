import type { CartWithTimer } from '../types';
import CartCard from './CartCard';

interface CartGridProps {
  carts: CartWithTimer[];
  onEditCart: (cart: CartWithTimer) => void;
}

export default function CartGrid({ carts, onEditCart }: CartGridProps) {
  if (carts.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-lg">אין עגלות פעילות</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">הוסף עגלה חדשה כדי להתחיל</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {carts.map((cart) => (
        <CartCard key={cart.id} cart={cart} onEdit={onEditCart} />
      ))}
    </div>
  );
}
