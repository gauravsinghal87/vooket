import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, Check, CalendarClock } from 'lucide-react';
import type { MonthlySuggestion } from '@/repositories/interfaces';
import { Rail, SectionHeader } from './section-header';
import { Image } from '@/components/ui/image';
import { Price } from '@/components/ui/price';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { useAddToCart } from '@/hooks/useCart';
import { discountPercent } from '@/components/product/product-card';
import { cn } from '@/lib/utils';

interface MonthlyEssentialsProps {
  items: MonthlySuggestion[];
}

function lastPurchasedLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export function MonthlyEssentials({ items }: MonthlyEssentialsProps) {
  const [addedAll, setAddedAll] = useState(false);

  const totalMovers = useMemo(() => items.filter((m) => m.recommendedQuantity > 1).length, [items]);

  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Your Monthly Essentials"
        subtitle={
          totalMovers > 0
            ? `Suggested for you · ${totalMovers} items to restock`
            : 'Based on your previous purchases'
        }
        Icon={Sparkles}
        to="/grocery"
      />

      <Rail>
        {items.map((m) => {
          const off = discountPercent(m.product);
          return (
            <article
              key={m.id}
              className="w-[184px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-card"
            >
              <Link to="/grocery" className="block relative m-2 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                <Image
                  src={m.product.image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
                {m.isEssential && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink-900/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    Essential
                  </span>
                )}
                {off !== null && (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-accent-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {off}% off
                  </span>
                )}
              </Link>

              <div className="px-2.5 pb-2.5">
                <p className="line-clamp-1 text-[13px] font-bold leading-tight text-neutral-900">{m.product.name}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{m.unitLabel}</p>

                <div className="mt-1 flex items-center justify-between">
                  <div>
                    <Price value={m.product.price} size="sm" />
                    <span className="ml-1 text-[10px] font-semibold text-neutral-400">
                      × {m.recommendedQuantity}
                    </span>
                  </div>
                  <AddToCartControl productId={m.product.id} type="grocery" size="sm" product={m.product} />
                </div>

                <p className="mt-1 flex items-center gap-1 border-t border-neutral-100 pt-1.5 text-[10px] text-neutral-500">
                  <CalendarClock className="h-3 w-3" /> Last bought {lastPurchasedLabel(m.lastPurchased)}
                </p>
              </div>
            </article>
          );
        })}
      </Rail>

      <div className="mt-2">
        <AddAllRow items={items} done={addedAll} onDone={() => setAddedAll(true)} />
      </div>
    </section>
  );
}

function AddAllRow({ items, done, onDone }: { items: MonthlySuggestion[]; done: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const { mutate } = useAddToCart();

  const addAll = () => {
    setBusy(true);
    items.forEach((m, idx) =>
      mutate(
        { product_id: m.product.id, quantity: m.recommendedQuantity, cart_type: 'grocery' },
        {
          onSettled: () => {
            if (idx === items.length - 1) {
              setBusy(false);
              onDone();
            }
          },
        }
      )
    );
  };

  return (
    <button
      onClick={addAll}
      disabled={busy}
      className={cn(
        'tap flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-[0.98]',
        done ? 'bg-success/10 text-success' : 'bg-ink-900 text-white shadow-pill hover:bg-ink-800'
      )}
      aria-label="Add all monthly essentials to cart"
    >
      {done ? (
        <>
          <Check className="h-4 w-4 animate-pop" /> Added to cart
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" /> Add all ({items.length} items)
        </>
      )}
    </button>
  );
}