import { useState } from 'react';
import { Loader2, Plus, Minus, SlidersHorizontal } from 'lucide-react';
import { useCart, useUpdateCartItem, useRemoveCartItem, resolveCartLine } from '@/hooks/useCart';
import { useCartAdd } from '@/hooks/useCartAdd';
import { useCartConflictStore } from '@/store/cartConflictStore';
import { hasCrossStoreConflict } from '@/lib/cartConflict';
import type { OrderType } from '@/types/models';
import type { Product } from '@/types/catalog';
import { hasActiveOptionGroups, needsOptionSelection } from '@/lib/productOptions';
import { VariableProductModal } from '@/components/product/variable-product-modal';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface AddToCartProps {
  productId: number;
  type: OrderType;
  size?: 'sm' | 'md' | 'icon' | 'outline' | 'add';
  product?: Product;
}

export function AddToCartControl({ productId, type, size = 'md', product }: AddToCartProps) {
  const [configuring, setConfiguring] = useState(false);
  const { data: cart } = useCart(type);
  const { submit, isPending: addPending } = useCartAdd();
  const openConflict = useCartConflictStore((s) => s.open);
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  const requiresOptions = !!product && needsOptionSelection(product);
  const isVariable = product?.product_type === 'variable';
  const selectable = !!product && hasActiveOptionGroups(product);
  const requiresConfigurator = isVariable || requiresOptions;

  // Bind to the product's canonical cart line (see resolveCartLine) so simple
  // *and* customisable products surface their real quantity.
  const item = resolveCartLine(cart?.items, productId);
  const qty = item?.quantity ?? 0;
  const busy = addPending || update.isPending || remove.isPending;

  const isCompact = size === 'sm';
  const isIconOnly = size === 'icon';
  const isOutline = size === 'outline';
  // The `add` size is the compact Zomato-style recommendation-card action: a
  // small white pill with a hairline service border, red ADD label and `+`.
  const isAdd = size === 'add';
  const dimBtn = isCompact || isAdd ? 'h-6 w-6' : 'h-8 w-8';
  const isGrocery = type === 'grocery';
  const serviceTone = isGrocery
    ? 'bg-grocery-500 text-ink-900 hover:bg-grocery-400'
    : 'bg-food-600 hover:bg-food-700';
  const addTone = isIconOnly
    ? serviceTone
    : isGrocery
      ? 'bg-grocery-500 text-ink-900 hover:bg-grocery-400'
      : 'bg-food-600 hover:bg-food-700';
  const addLabel = cn(
    'inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-bold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-95 disabled:pointer-events-none disabled:opacity-60',
    addTone
  );
  /**
   * The icon-only ADD button is the card action, so its footprint is
   * service-aware: Grocery gets a tap-friendly 44px yellow circle that fits the
   * narrow product cards without pushing against the price, while Food keeps its
   * existing 32px red control. Neither size can grow, so the button can never
   * widen a card or spill past its edge.
   */
  const addSize = isIconOnly
    ? isGrocery
      ? 'h-11 w-11'
      : 'h-8 w-8'
    : isCompact
      ? 'h-8 px-2.5 text-[11px]'
      : 'h-8 px-3 text-xs';
  const plusSize = isIconOnly && isGrocery ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const spinnerSize = isIconOnly && isGrocery ? 'h-5 w-5' : 'h-3.5 w-3.5';

  /**
   * The `outline` size is the compact Zomato-style menu action: a white pill
   * with a hairline service-coloured border and matching text plus a small `+`.
   * It sits at the bottom edge of the product thumbnail. Food uses the primary
   * red, Grocery its gold, so the shared control never leaks the wrong theme.
   */
  const outlineLabel = cn(
    'relative inline-flex h-11 min-w-[136px] shrink-0 items-center justify-center rounded-xl border-[1.5px] px-4 text-[15px] font-extrabold uppercase leading-none tracking-wide shadow-sm transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2',
    isGrocery
      ? 'border-grocery-600 bg-grocery-50 text-grocery-700 hover:bg-grocery-100 focus-visible:outline-grocery-600'
      : 'border-food-600 bg-food-50 text-food-600 hover:bg-food-100 focus-visible:outline-food-600'
  );
  /* The reference sets `ADD` large and centred with a small `+` tucked into the
     pill's top-right corner rather than trailing the word inline. */
  const outlineContent = (
    <>
      Add
      <Plus className="absolute right-2.5 top-2 h-3 w-3" strokeWidth={2.5} />
    </>
  );

  /**
   * Compact recommendation-card action (Zomato style): a small white control
   * with a thin service-coloured border, matching uppercase label and a small
   * `+`. Sized to sit beside the price inside the narrow `Complete your meal`
   * card without growing it or clashing with the image above.
   */
  const compactLabel = cn(
    'inline-flex h-[34px] shrink-0 items-center justify-center gap-1 rounded-lg border-[1.5px] bg-white px-2.5 text-[12px] font-extrabold uppercase leading-none tracking-wide shadow-sm transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2',
    isGrocery
      ? 'border-grocery-600 text-grocery-700 hover:bg-grocery-50 focus-visible:outline-grocery-600'
      : 'border-food-600 text-food-600 hover:bg-food-50 focus-visible:outline-food-600'
  );
  const compactContent = (
    <>
      Add
      <Plus className="h-3.5 w-3.5" />
    </>
  );

  const openConfigurator = () => {
    if (!selectable) {
      toast('This item is unavailable right now', 'error');
      return;
    }
    setConfiguring(true);
  };

  /**
   * Simple-product add. When the cart already belongs to another restaurant the
   * conflict is known up front, so the replacement dialog opens without a
   * doomed POST; otherwise the request runs and the server response is the
   * authority (the cart cache may be stale).
   */
  const handleAdd = () => {
    const payload = { product_id: productId, quantity: 1, cart_type: type };
    if (hasCrossStoreConflict(cart, product?.vendor_id)) {
      openConflict({
        payload,
        productName: product?.name,
        onAdded: () => toast('Added to cart'),
      });
      return;
    }
    submit(payload, {
      productName: product?.name,
      onError: (err) => toast(err instanceof Error ? err.message : 'Could not add to cart', 'error'),
    });
  };

  // With no matching line in the cart the action is the entry point: a direct
  // add for simple products, or the customisation selector for variable ones. A
  // variable product is never added with an arbitrary default variation.
  if (qty === 0) {
    return (
      <>
        <button
          type="button"
          aria-label="Add to cart"
          title="Add to cart"
          onClick={
            requiresConfigurator
              ? openConfigurator
              : handleAdd
          }
          className={isAdd ? compactLabel : isOutline ? outlineLabel : cn(addLabel, addSize)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className={cn(isAdd ? 'h-4 w-4' : spinnerSize, 'animate-spin')} />
          ) : isAdd ? (
            compactContent
          ) : isOutline ? (
            outlineContent
          ) : isIconOnly ? (
            <Plus className={plusSize} />
          ) : isCompact ? (
            <>
              Add
              <Plus className="h-3.5 w-3.5" />
            </>
          ) : requiresConfigurator ? (
            <>
              <SlidersHorizontal className="h-4 w-4" />
              Add to cart
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add to cart
            </>
          )}
        </button>

        {configuring && product && (
          <VariableProductModal
            key={product.id}
            product={product}
            type={type}
            open
            onOpenChange={(open) => !open && setConfiguring(false)}
          />
        )}
      </>
    );
  }

  /**
   * Once an item is in the cart the `outline` (menu-row) action becomes the
   * compact Zomato-style selector: a solid service-coloured pill with a minus on
   * the left, the live quantity centred and a plus on the right, all in the
   * service text colour. It overhangs the product image (the row positions it)
   * and every tap drives the real cart mutation — no separate UI quantity state.
   */
  if (isOutline) {
    return (
      <div
        className={cn(
          // Matches the ADD pill's footprint so swapping between the two never
          // shifts the photo or the caption underneath it.
          'inline-flex h-11 min-w-[136px] items-center justify-between gap-1 p-1 shadow-md',
          // Zomato's in-menu stepper: a solid red rounded rectangle for food,
          // the gold pill Grocery has always used.
          isGrocery ? 'rounded-xl bg-grocery-500 text-ink-900' : 'rounded-xl bg-food-600 text-white'
        )}
      >
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={busy}
          onClick={() => (qty - 1 <= 0 ? remove.mutate(item!.id) : update.mutate({ itemId: item!.id, quantity: qty - 1 }))}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-90 disabled:opacity-60',
            isGrocery ? 'hover:bg-black/10' : 'hover:bg-white/20'
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-6 text-center text-sm font-extrabold tabular-nums">{qty}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={busy}
          onClick={() => update.mutate({ itemId: item!.id, quantity: qty + 1 })}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-90 disabled:opacity-60',
            isGrocery ? 'hover:bg-black/10' : 'hover:bg-white/20'
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-neutral-200',
        (isCompact || isAdd) && 'gap-0.5 p-0.5'
      )}
    >
      <button
        aria-label="Decrease"
        onClick={() => (qty - 1 <= 0 ? remove.mutate(item!.id) : update.mutate({ itemId: item!.id, quantity: qty - 1 }))}
        className={cn(
          'flex items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 active:scale-90',
          dimBtn
        )}
      >
        <Minus className={isCompact || isAdd ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
      <span className="min-w-5 text-center text-sm font-bold text-neutral-900">{qty}</span>
      <button
        aria-label="Increase"
        onClick={() => update.mutate({ itemId: item!.id, quantity: qty + 1 })}
        className={cn(
          'flex items-center justify-center rounded-full text-white transition-colors active:scale-90',
          serviceTone,
          dimBtn
        )}
      >
        <Plus className={isCompact || isAdd ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
    </div>
  );
}