import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Share2, Star } from 'lucide-react';
import type { Product } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { Price } from '@/components/ui/price';
import { discountPercent } from '@/components/product/product-card';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { hasActiveOptionGroups } from '@/lib/productOptions';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

function VegMark({ isVeg }: { isVeg: boolean | null }) {
  if (isVeg === null) return null;
  const color = isVeg ? 'border-success' : 'border-danger';
  const dot = isVeg ? 'bg-success' : 'bg-danger';
  return (
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 bg-white', color)} title={isVeg ? 'Pure veg' : 'Non-veg'}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
    </span>
  );
}

/* Saved items live on this device: there is no server-side wishlist endpoint,
   so the bookmark persists to localStorage rather than pretending to sync. */
const SAVED_KEY = 'vooket.saved-products';

function readSaved(): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * Zomato's menu row, mirrored: the veg mark, name, price, offer line and
 * description stack in the left column with the bookmark/share actions under
 * them, while the dish photo sits on the right with the `ADD` pill straddling
 * its bottom edge and the `customisable` caption beneath it.
 *
 * Offer, veg and availability are read from the product itself, so the numbers
 * can never disagree with the rest of the app; the badge reflects the backend's
 * `is_featured` flag rather than a popularity figure the API does not expose.
 */
export function ProductListItem({ product, type = 'food' }: { product: Product; type?: 'food' | 'grocery' }) {
  const [saved, setSaved] = useState(() => readSaved().includes(product.id));
  const off = discountPercent(product);
  const variable = product.product_type === 'variable' || hasActiveOptionGroups(product);
  const discounted =
    product.compare_at_price &&
    parseFloat(product.compare_at_price) > parseFloat(product.price);

  const toggleSaved = () => {
    const ids = readSaved();
    const next = ids.includes(product.id) ? ids.filter((id) => id !== product.id) : [...ids, product.id];
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* Storage may be unavailable (private mode); state below still updates. */
    }
    const nowSaved = next.includes(product.id);
    setSaved(nowSaved);
    toast(nowSaved ? 'Saved for later' : 'Removed from saved items');
  };

  const shareItem = async () => {
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard');
    } catch (err) {
      // A dismissed share sheet is not a failure worth surfacing.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast('Could not share this item', 'error');
    }
  };

  return (
    <div className="flex items-start gap-3.5 py-5 sm:gap-5">
      {/* Left — veg mark, name, badge, price, description and the row actions. */}
      <div className="min-w-0 flex-1">
        {product.is_veg !== null && (
          <span className="mb-2 inline-flex">
            <VegMark isVeg={product.is_veg} />
          </span>
        )}

        <Link to={`/product/${product.id}`} state={{ product, type }} className="block" aria-label={product.name}>
          <h4 className="text-[17px] font-semibold leading-snug tracking-tight text-neutral-900">
            {product.name}
          </h4>
        </Link>

        {product.is_featured && (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" strokeWidth={0} />
            Bestseller
          </span>
        )}

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Price value={product.price} size="md" />
          {discounted && (
            <span className="text-xs text-neutral-400 line-through">
              ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        {off !== null && product.is_available && (
          <p className="mt-0.5 text-[13px] font-bold text-z-info">{off}% OFF</p>
        )}

        {product.description && (
          <p className="mt-1.5 line-clamp-2 max-w-[22rem] text-[14px] leading-snug text-neutral-500">
            {product.description}
          </p>
        )}

        {!product.is_available && (
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-danger">Out of stock</p>
        )}

        {/* Save and share, as circular hairline buttons under the copy. */}
        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleSaved}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            title={saved ? 'Saved' : 'Save for later'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              saved
                ? 'border-food-600 bg-food-50 text-food-600'
                : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            )}
          >
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={shareItem}
            aria-label={`Share ${product.name}`}
            title="Share"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
          >
            <Share2 className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Right — the dish photo with the ADD pill straddling its lower edge. */}
      <div className="w-[150px] shrink-0 sm:w-[168px]">
        {/* `mb-6` reserves the pill's overhang in layout, so the row's own
            height always keeps the pill clear of the divider below it. */}
        <div className="relative mb-6">
          <Link
            to={`/product/${product.id}`}
            state={{ product, type }}
            className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100"
            aria-label={product.name}
          >
            <Image src={product.image} className="h-full w-full object-cover" />
            {!product.is_available && <span className="absolute inset-0 bg-ink-900/45" />}
          </Link>

          {/* Half in / half out of the photo, as in the reference. */}
          <div className="absolute inset-x-0 top-full flex -translate-y-1/2 justify-center">
            <AddToCartControl productId={product.id} type={type} size="outline" product={product} />
          </div>
        </div>

        {variable && (
          <span className="mt-1.5 block text-center text-[11px] text-neutral-400">customisable</span>
        )}
      </div>
    </div>
  );
}
