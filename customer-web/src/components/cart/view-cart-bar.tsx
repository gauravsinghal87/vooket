import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';
import type { OrderType } from '@/types/models';
import { cn } from '@/lib/utils';

const toneFor = (type: OrderType) =>
  type === 'grocery'
    ? { bar: 'bg-grocery-500 text-ink-900 hover:bg-grocery-400', chip: 'bg-ink-900/10' }
    : { bar: 'bg-food-600 hover:bg-food-700', chip: 'bg-white/20' };

export function ViewCartBar({ type, bottomClass }: { type: OrderType; bottomClass?: string }) {
  const { data: cart } = useCart(type);

  const count = (cart?.items ?? []).reduce((n, i) => n + i.quantity, 0);
  if (!cart || count === 0) return null;

  const tone = toneFor(type);
  const label = `${count} ${count === 1 ? 'item' : 'items'}`;

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40 px-[var(--page-gutter)]',
        bottomClass ?? 'bottom-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom)+var(--spacing)*3)]'
      )}
    >
      <Link
        to={`/cart?type=${type}`}
        aria-label={`View cart, ${label}, total ${formatCurrency(cart.total)}`}
        className={cn(
          'mx-auto flex max-w-3xl items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-float transition-colors',
          tone.bar
        )}
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto text-sm font-bold">{formatCurrency(cart.total)}</span>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold', tone.chip)}>
          View Cart
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}
