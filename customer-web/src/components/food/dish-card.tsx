import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Product } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { Price } from '@/components/ui/price';
import { discountPercent } from '@/components/product/product-card';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { cn } from '@/lib/utils';

function VegMark({ isVeg }: { isVeg: boolean | null }) {
  const color = isVeg ? 'border-success' : 'border-danger';
  const dot = isVeg ? 'bg-success' : 'bg-danger';
  return (
    <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-2 bg-white', color)} title={isVeg ? 'Pure veg' : 'Non veg'}>
      <span className={cn('h-1 w-1 rounded-full', dot)} />
    </span>
  );
}

export function DishCard({ product, className }: { product: Product; className?: string }) {
  const off = discountPercent(product);
  const soldOut = !product.is_available;

  return (
    <div
      className={cn(
        'group w-[172px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float',
        className
      )}
    >
      <Link to={`/product/${product.id}`} state={{ product, type: 'food' }} className="block" aria-label={product.name}>
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
          <Image
            src={product.image}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {off !== null && !soldOut && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-food-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
              {off}% off
            </span>
          )}
          {soldOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink-900/45 text-[10px] font-extrabold uppercase tracking-widest text-white">
              Sold out
            </span>
          )}
        </div>
      </Link>

      <div className="p-2.5">
        <Link to={`/product/${product.id}`} state={{ product, type: 'food' }} className="block">
          <p className="line-clamp-2 min-h-9 text-[13px] font-bold leading-tight text-neutral-900">{product.name}</p>
        </Link>

        <div className="mt-1.5 flex items-center gap-1.5">
          <p className={cn('flex items-center gap-1 text-[11px] text-neutral-500', !product.unit_label && !soldOut && 'text-xs text-neutral-400')}>
            {product.unit_label ?? (product.is_available ? 'Available' : 'Out of stock')}
          </p>
          {product.is_veg !== null && <VegMark isVeg={product.is_veg} />}
          {!soldOut && product.is_available && (
            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-neutral-400">
              <Star className="h-2.5 w-2.5 fill-warning text-warning" />
              In stock
            </span>
          )}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <Price value={product.price} size="sm" />
              {product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price) && (
                <span className="text-[10px] text-neutral-400 line-through">
                  ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>
          <AddToCartControl productId={product.id} type="food" size="icon" product={product} />
        </div>
      </div>
    </div>
  );
}