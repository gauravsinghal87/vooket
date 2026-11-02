import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Product } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { Price } from '@/shared/components/ui/price';
import { AddToCartControl } from './add-to-cart';
import { cn } from '@/shared/utils/utils';
import type { OrderType } from '@/shared/types/models';

interface ProductCardProps {
  product: Product;
  type: OrderType;
  horizontal?: boolean;
  addSize?: 'sm' | 'md' | 'icon';
  className?: string;
}

export function discountPercent(p: Product): number | null {
  if (p.compare_at_price === null) return null;
  const mrp = parseFloat(p.compare_at_price);
  const price = parseFloat(p.price);
  if (mrp <= 0 || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

function VegMark({ isVeg }: { isVeg: boolean | null }) {
  const color = isVeg ? 'border-success' : 'border-danger';
  const dot = isVeg ? 'bg-success' : 'bg-danger';
  return (
    <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-2 bg-white', color)}>
      <span className={cn('h-1 w-1 rounded-full', dot)} />
    </span>
  );
}

export function ProductCard({ product, type, horizontal = false, addSize, className }: ProductCardProps) {
  const off = discountPercent(product);
  /**
   * Grocery cards default to the compact circular + button so it can never grow
   * past the card edge; Food keeps its existing labelled button. Call sites can
   * still override either way.
   */
  const addControlSize = addSize ?? (type === 'grocery' ? 'icon' : 'md');

  return (
    <div
      className={cn(
        'group rounded-2xl border border-neutral-200/70 bg-white p-2.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float',
        horizontal && 'w-[172px] shrink-0 snap-start',
        !horizontal && 'w-full',
        className
      )}
    >
      <Link to={`/product/${product.id}`} state={{ product, type }} className="block">
        <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
          <Image
            src={product.image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {off !== null && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-food-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
              {off}% off
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          {product.brand?.name && (
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {product.brand.name}
            </p>
          )}
          <Link to={`/product/${product.id}`} state={{ product, type }} className="mt-0.5 block">
            <p className="line-clamp-1 text-[13px] font-bold text-neutral-900">{product.name}</p>
          </Link>
          {product.unit_label && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
              {product.unit_label}
              {product.is_veg !== null && <VegMark isVeg={product.is_veg} />}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <Price value={product.price} size="sm" />
            {product.compare_at_price && (
              <span className="text-[10px] text-neutral-400 line-through">
                ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {product.is_available ? (
            <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-neutral-400">
              <Star className="h-2.5 w-2.5 fill-warning text-warning" /> In stock
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] font-semibold text-danger">Out of stock</p>
          )}
        </div>
        <AddToCartControl productId={product.id} type={type} product={product} size={addControlSize} />
      </div>
    </div>
  );
}