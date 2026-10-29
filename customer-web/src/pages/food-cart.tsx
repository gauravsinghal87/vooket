import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GroceryCartPage } from './grocery-cart';
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Gift,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShoppingBag,
  Tag,
  Trash2,
  Wallet as WalletIcon,
  Zap,
} from 'lucide-react';
import { repositories } from '@/repositories';
import type { Product, Restaurant } from '@/types/catalog';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useCartStore } from '@/store/cartStore';
import {
  useApplyCoupon,
  useCart,
  useRemoveCoupon,
  useRemoveCartItem,
  useSetDeliveryAddress,
  useSyncCartAddress,
  useUpdateCartItem,
} from '@/hooks/useCart';
import { hasActiveOptionGroups } from '@/lib/productOptions';
import { ProductConfigurator, type ProductConfiguratorAddPayload } from '@/components/product/product-configurator';
import { SelectedOptionsList } from '@/components/product/selected-options';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { FoodPreparationChips } from '@/components/order/food-preparation-chips';
import { DeliveryInstructions } from '@/components/order/delivery-instructions';
import { Image } from '@/components/ui/image';
import { Card } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Rail } from '@/components/home/section-header';
import { toast } from '@/components/ui/toast';
import { LocationSelector } from '@/components/layout/location-selector';
import { completeOrderPayment, createUsableCheckout } from '@/lib/razorpay';
import { getBranding } from '@/lib/branding';
import { deliveryEtaText } from '@/lib/delivery-eta';
import { DEFAULT_LOCATION } from '@/lib/location';
import { cn, formatCurrency } from '@/lib/utils';

type FoodCart = NonNullable<Awaited<ReturnType<typeof repositories.cart.getByType>>>;

type OptionSelection = { group_id: number; option_id: number };

function optionSignature(options: OptionSelection[] | null | undefined): string {
  if (!options) return '';
  return [...options]
    .sort((a, b) => a.group_id - b.group_id || a.option_id - b.option_id)
    .map((o) => `${o.group_id}:${o.option_id}`)
    .join('|');
}

function firstRestaurantId(cart: FoodCart | null | undefined): number | null {
  return cart?.items[0]?.product?.restaurant_id ?? null;
}

export function FoodCartPage() {
  const navigate = useNavigate();
  const setService = useAppStore((s) => s.setService);
  const locOpen = useAppStore((s) => s.locationSelectorOpen);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const setLocOpen = (open: boolean) => (open ? openLocationSelector() : closeLocationSelector());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    setService('food');
  }, [setService]);

  const cartQuery = useCart('food');
  const cart = cartQuery.data;

  // The cart follows the location chosen on the home header (see the hook).
  useSyncCartAddress('food', cart);

  const restaurantId = firstRestaurantId(cart);
  const restaurantQuery = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => repositories.food.getRestaurant(restaurantId as number),
    enabled: !!restaurantId,
  });
  const menuQuery = useQuery({
    queryKey: ['restaurant-menu', restaurantId],
    queryFn: () => repositories.food.getMenu(restaurantId as number),
    enabled: !!restaurantId,
  });
  const couponsQuery = useQuery({
    queryKey: ['coupons'],
    queryFn: () => repositories.user.getCoupons(),
    enabled: !!cart && cart.items.length > 0 && isAuthenticated,
  });

  const items = cart?.items ?? [];
  const hasItems = !cartQuery.isLoading && !cartQuery.isError && !!cart && items.length > 0;

  const restaurant = restaurantQuery.data;
  const menuProducts = useMemo(() => (menuQuery.data ?? []).flatMap((c) => c.products ?? []), [menuQuery.data]);

  return (
    <div className={cn('mx-auto flex max-w-2xl flex-col gap-3', hasItems && 'pb-32')}>
      {cartQuery.isLoading && (
        <div className="space-y-3 pt-1">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {cartQuery.isError && (
        <ErrorState
          title="Couldn't load your cart"
          description="Something went wrong while fetching your cart."
          action={{ label: 'Retry', onClick: () => cartQuery.refetch() }}
        />
      )}

      {!cartQuery.isLoading && !cartQuery.isError && (!cart || items.length === 0) && (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add delicious meals from a restaurant to get started."
          action={{ label: 'Browse restaurants', onClick: () => navigate('/restaurants') }}
        />
      )}

      {hasItems && cart && restaurantId && restaurant != null && (
        <CartHeader
          restaurant={restaurant}
          cart={cart}
          onChooseAddress={() => openLocationSelector()}
        />
      )}

      {hasItems && cart && parseFloat(cart.discount) > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] font-bold text-brand-700">
          <span aria-hidden>🎉</span>
          You saved {formatCurrency(parseFloat(cart.discount))} on this order
        </p>
      )}

      {hasItems && cart && restaurant && restaurant.free_delivery_above && (
        <FreeDeliveryOffer threshold={restaurant.free_delivery_above} subtotal={cart.subtotal} />
      )}

      {hasItems && cart && (
        <CartItemsSection
          cart={cart}
          menuProducts={menuProducts}
        />
      )}

      {hasItems && restaurantId && <AddMoreItemsLink restaurantId={restaurantId} />}

      {hasItems && (
        <PreparationSection />
      )}

      {hasItems && <DeliveryInstructions type="food" />}

      {hasItems && menuProducts.length > 0 && (
        <CompleteYourMeal
          products={menuProducts}
          inCartIds={new Set(items.map((i) => i.product_id))}
        />
      )}

      {hasItems && restaurant && (
        <DeliveryBlock
          etaMin={restaurant.avg_delivery_time_min ?? null}
          cart={cart}
          isAuthenticated={isAuthenticated}
          onChooseAddress={() => openLocationSelector()}
        />
      )}

      {hasItems && (
        <CouponsSection
          couponCode={cart.coupon_code}
          coupons={couponsQuery.data ?? []}
          discount={cart.discount}
          loading={couponsQuery.isLoading}
          isAuthenticated={isAuthenticated}
        />
      )}

      {hasItems && <ContactCard />}

      {hasItems && <BillCard cart={cart} />}

      {hasItems && (
        <p className="px-1 text-[11px] leading-relaxed text-neutral-400">
          <span className="font-bold uppercase tracking-wide text-neutral-400">Cancellation policy</span>
          <br />
          A 100% cancellation charge may apply. This helps us compensate the restaurant partner for food
          preparation.
        </p>
      )}

      {hasItems && cart && (
        <PaymentBar cart={cart} onChooseAddress={() => openLocationSelector()} />
      )}

      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </div>
  );
}

export function CartRoute() {
  const [params] = useSearchParams();
  return params.get('type') === 'grocery' ? <GroceryCartPage /> : <FoodCartPage />;
}

/**
 * Zomato's cart header: the restaurant's name over the delivery line — green
 * ETA, "to {label}", the address and a chevron that opens the address picker,
 * so the location is chosen right here in the cart.
 */
function CartHeader({
  restaurant,
  cart,
  onChooseAddress,
}: {
  restaurant: Restaurant;
  cart: FoodCart;
  onChooseAddress: () => void;
}) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const selected = cart.address_id
    ? (addresses.data ?? []).find((a) => a.id === cart.address_id)
    : (addresses.data ?? []).find((a) => a.is_default) ?? null;

  const label = selected?.label ?? activeLocation.label;
  const addressText = selected
    ? `${selected.address_line_1}${selected.address_line_2 ? `, ${selected.address_line_2}` : ''}, ${selected.city}`
    : activeLocation.address;

  const eta = deliveryEtaText(restaurant);
  const etaText = eta ?? (restaurant.avg_delivery_time_min ? `${restaurant.avg_delivery_time_min} mins` : null);

  return (
    <header className="sticky top-0 z-30 -mx-[var(--page-gutter)] flex items-start gap-2 border-b border-neutral-100 bg-white/95 px-[var(--page-gutter)] py-2.5 backdrop-blur">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="tap -ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-neutral-500">{restaurant.name}</p>
        <button
          type="button"
          onClick={onChooseAddress}
          aria-label="Change delivery address"
          className="tap mt-0.5 flex w-full items-center gap-1 text-left"
        >
          <span className="shrink-0 text-[15px] font-bold text-neutral-900">
            {etaText && <span className="text-z-green">{etaText} </span>}
            to {label}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-neutral-700">&nbsp;| {addressText}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
        </button>
      </div>
    </header>
  );
}

function FreeDeliveryOffer({ threshold, subtotal }: { threshold: string; subtotal: string }) {
  const thresholdValue = parseFloat(threshold);
  const subtotalValue = parseFloat(subtotal);
  const remaining = Math.max(0, thresholdValue - subtotalValue);
  const unlocked = remaining <= 0;
  const progress = Math.min(100, (subtotalValue / thresholdValue) * 100);

  return (
    <Card className="border-food-100 bg-food-50/60 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-food-100 text-food-600">
          <Gift className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900">
            Special offer for you
            {unlocked && (
              <span className="flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">
                <CheckCircle2 className="h-3 w-3" /> Unlocked
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {unlocked
              ? 'Free delivery is applied automatically at checkout.'
              : `Get free delivery (₹0) on orders above ${formatCurrency(thresholdValue)}.`}
          </p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={cn('h-full rounded-full transition-all', unlocked ? 'bg-success' : 'bg-food-500')}
          style={{ width: `${progress}%` }}
        />
      </div>
      {!unlocked && (
        <p className="mt-1.5 text-right text-[11px] font-semibold text-neutral-500">
          Add {formatCurrency(remaining)} more to unlock
        </p>
      )}
    </Card>
  );
}

function CartItemsSection({
  cart,
  menuProducts,
}: {
  cart: FoodCart;
  menuProducts: Product[];
}) {
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const [editingId, setEditingId] = useState<number | null>(null);

  const editingItem = cart.items.find((i) => i.id === editingId) ?? null;
  const editingProduct = (editingItem && (menuProducts.find((p) => p.id === editingItem.product_id) ?? null)) || null;
  const editingAvailability = editingItem
    ? !!editingProduct && (editingProduct.product_type === 'variable' || hasActiveOptionGroups(editingProduct))
    : false;

  const busyId = (id: number) => updateItem.isPending && updateItem.variables?.itemId === id;

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <h2 className="text-[17px] font-semibold tracking-tight text-neutral-900">Cart items</h2>
        <span className="text-xs font-semibold text-neutral-400">{cart.items.length} item{cart.items.length === 1 ? '' : 's'}</span>
      </div>

      <Card className="divide-y divide-neutral-100 p-0">
        {cart.items.map((item) => (
          <FoodCartLine
            key={item.id}
            item={item}
            busy={busyId(item.id)}
            onQuantity={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
            onRemove={() => removeItem.mutate(item.id)}
            onEdit={() => setEditingId(item.id)}
            editable={item.product_id ? menuProducts.some((p) => p.id === item.product_id && (p.product_type === 'variable' || hasActiveOptionGroups(p))) : false}
          />
        ))}
      </Card>

      {editingItem && editingProduct && editingAvailability && (
        <EditItemSheet
          item={editingItem}
          product={editingProduct}
          open={editingId !== null}
          onOpenChange={(open) => !open && setEditingId(null)}
        />
      )}
    </section>
  );
}

function FoodCartLine({
  item,
  busy,
  onQuantity,
  onRemove,
  onEdit,
  editable,
}: {
  item: FoodCart['items'][number];
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onEdit: () => void;
  editable: boolean;
}) {
  const name = item.product?.name ?? 'Item';
  const hasOptions = !!item.selected_options && item.selected_options.length > 0;

  return (
    <div className="flex gap-3 p-3.5">
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
        <Image src={item.product?.image} className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold tracking-tight text-neutral-900">{name}</p>
            {item.product?.unit_label && <p className="text-[11px] text-neutral-500">{item.product.unit_label}</p>}
          </div>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className={cn(
              'shrink-0 rounded-full p-1 text-neutral-300 transition-colors hover:text-danger',
              busy && 'pointer-events-none opacity-50'
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {hasOptions && <SelectedOptionsList options={item.selected_options} inline className="mt-1" />}
        {item.selected_addons && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{String(item.selected_addons)}</p>
        )}

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            ) : (
              <p className="text-[12px] text-neutral-500">
                <Price value={item.unit_price} size="sm" />
                <span className="text-neutral-400"> × {item.quantity}</span>
              </p>
            )}
            <p className="mt-0.5 text-[14px] font-extrabold text-neutral-900">
              <Price value={item.line_total} size="md" />
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {editable && (
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-neutral-700 transition-colors hover:border-food-400 hover:text-food-600 disabled:opacity-50"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            <QuantityStepper size="sm" tone="food" value={item.quantity} onChange={onQuantity} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EditItemSheet({
  item,
  product,
  open,
  onOpenChange,
}: {
  item: FoodCart['items'][number];
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const removeItem = useRemoveCartItem();

  const selections: Record<number, number[]> = {};
  for (const option of item.selected_options ?? []) {
    (selections[option.group_id] ??= []).push(option.option_id);
  }

  const originalSignature = optionSignature(item.selected_options);

  const handleAdded = (payload: ProductConfiguratorAddPayload) => {
    const nextSignature = optionSignature(payload.selected_options);
    // If the configuration changed, the freshly added line is a different
    // variant — remove the old line so we never duplicate.
    if (nextSignature !== originalSignature) {
      removeItem.mutate(item.id);
    }
    onOpenChange(false);
  };

  return (
    <BottomSheet title={item.product?.name ?? 'Edit item'} open={open} onOpenChange={onOpenChange} className="sm:max-w-md">
      <ProductConfigurator
        key={`${item.id}-${originalSignature}`}
        product={product}
        type="food"
        variant="bare"
        sticky
        initialSelections={selections}
        initialQuantity={item.quantity}
        onAdded={handleAdded}
      />
    </BottomSheet>
  );
}

function AddMoreItemsLink({ restaurantId }: { restaurantId: number }) {
  return (
    <Link
      to={`/restaurant/${restaurantId}`}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-neutral-200 bg-white py-3 text-sm font-bold text-food-600 transition-colors hover:border-food-300 hover:text-food-700"
    >
      <Plus className="h-4 w-4" /> Add more items
    </Link>
  );
}

function PreparationSection() {
  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const setFoodRestaurantNote = useCartStore((s) => s.setFoodRestaurantNote);
  const setFoodNoCutlery = useCartStore((s) => s.setFoodNoCutlery);

  return (
    <FoodPreparationChips
      note={foodRestaurantNote}
      noCutlery={foodNoCutlery}
      onNoteChange={setFoodRestaurantNote}
      onNoCutleryChange={setFoodNoCutlery}
    />
  );
}

function CompleteYourMeal({ products, inCartIds }: { products: Product[]; inCartIds: Set<number> }) {
  const suggestions = useMemo(
    () =>
      products
        .filter((p) => p.is_available && !inCartIds.has(p.id))
        .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
        .slice(0, 10),
    [products, inCartIds]
  );

  if (suggestions.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1.5 px-0.5 text-[17px] font-semibold tracking-tight text-neutral-900">Complete your meal</h2>
      <Rail>
        {suggestions.map((product) => (
          <div key={product.id} className="w-[150px] shrink-0 rounded-2xl border border-neutral-200 bg-white p-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
              <Image src={product.image} className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 min-w-0 truncate text-[13px] font-bold text-neutral-900" title={product.name}>
              {product.name}
            </p>
            <div className="mt-1 flex items-center justify-between gap-1">
              <Price value={product.price} size="sm" className="shrink-0 whitespace-nowrap" />
              <AddToCartControl productId={product.id} type="food" size="add" product={product} />
            </div>
          </div>
        ))}
      </Rail>
    </section>
  );
}

function CouponsSection({
  couponCode,
  coupons,
  discount,
  loading,
  isAuthenticated,
}: {
  couponCode: string | null;
  coupons: Awaited<ReturnType<typeof repositories.user.getCoupons>>;
  /** The cart's active discount, shown as the savings figure on the applied row. */
  discount: string;
  loading: boolean;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();

  const applyCode = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    applyCoupon.mutate(trimmed, {
      onSuccess: () => {
        toast('Coupon applied');
        setCode('');
        setOpen(false);
      },
      onError: () => toast('This coupon can\u2019t be applied', 'error'),
    });
  };

  const shown = coupons.slice(0, 3);
  const saved = parseFloat(discount) || 0;

  return (
    <section>
      {!isAuthenticated ? (
        <Card className="p-3.5">
          <p className="text-sm font-semibold text-neutral-900">Apply a coupon</p>
          <p className="mt-0.5 text-xs text-neutral-500">Login to apply coupons and save on this order.</p>
          <Link
            to="/auth/login"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
          >
            Login now <ChevronRight className="h-3 w-3" />
          </Link>
        </Card>
      ) : (
        <Card className="divide-y divide-neutral-100 p-0">
          {/* Zomato's applied row: green tick, "applied" headline, savings. */}
          {couponCode ? (
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-neutral-900">
                    {couponCode} applied!
                  </p>
                  <button
                    onClick={() => removeCoupon.mutate()}
                    className="mt-0.5 text-xs font-bold text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {saved > 0 && (
                <span className="shrink-0 text-[15px] font-extrabold text-z-info">
                  – {formatCurrency(saved)}
                </span>
              )}
            </div>
          ) : loading ? (
            <Skeleton className="m-3 h-12 rounded-xl" />
          ) : (
            shown.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-neutral-900">{coupon.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                    {coupon.description ?? `Use code ${coupon.code}`}
                  </p>
                </div>
                <button
                  onClick={() => applyCode(coupon.code)}
                  disabled={applyCoupon.isPending}
                  className="shrink-0 rounded-full border border-food-600 bg-white px-3.5 py-1.5 text-[12px] font-extrabold text-food-600 transition-colors hover:bg-food-50 disabled:opacity-50"
                >
                  APPLY
                </button>
              </div>
            ))
          )}

          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <Tag className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[15px] font-semibold text-neutral-800">View all coupons</span>
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </button>
        </Card>
      )}

      <BottomSheet title="Apply coupon" open={open} onOpenChange={setOpen}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyCode(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter coupon code"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" className="flex-1" disabled={!code.trim() || applyCoupon.isPending}>
              {applyCoupon.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </div>
        </form>

        {coupons.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Available coupons</p>
            <div className="space-y-2">
              {coupons.map((coupon) => (
                <button
                  key={coupon.id}
                  onClick={() => applyCode(coupon.code)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-neutral-200 p-3 text-left transition-colors hover:border-brand-300"
                >
                  <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-extrabold tracking-wide text-brand-600">
                    {coupon.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-neutral-900">{coupon.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                      {coupon.description}
                      {parseFloat(coupon.min_order_amount) > 0 && ` · Min. order ${formatCurrency(Number(coupon.min_order_amount))}`}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}

/**
 * Zomato's delivery card: the green ETA line, then the "Delivery at {label}"
 * row whose chevron opens the address picker — the delivery location is chosen
 * directly from the cart, exactly like the reference.
 */
function DeliveryBlock({
  etaMin,
  cart,
  isAuthenticated,
  onChooseAddress,
}: {
  etaMin: string | null;
  cart: FoodCart;
  isAuthenticated: boolean;
  onChooseAddress: () => void;
}) {
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const selected = cart.address_id
    ? (addresses.data ?? []).find((a) => a.id === cart.address_id)
    : (addresses.data ?? []).find((a) => a.is_default) ?? null;

  const label = selected?.label ?? (isAuthenticated ? 'address' : activeLocation.label);
  const addressText = selected
    ? `${selected.address_line_1}${selected.address_line_2 ? `, ${selected.address_line_2}` : ''}, ${selected.city}`
    : activeLocation.address;

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex items-center gap-2 px-4 py-3.5">
        <Zap className="h-4.5 w-4.5 shrink-0 fill-z-green text-z-green" />
        <p className="text-[15px] font-bold text-neutral-900">
          Delivery in <span className="text-z-green">{etaMin ? `${etaMin} mins` : 'as soon as possible'}</span>
        </p>
      </div>

      <div className="mx-4 border-t border-neutral-100" />

      <button
        type="button"
        onClick={onChooseAddress}
        className="tap flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
      >
        <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="text-[15px] font-bold text-neutral-900">Delivery at {label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
            {selected ? addressText : 'Choose a delivery address'}
          </span>
          {!isAuthenticated && (
            <span className="mt-1 block text-[13px] font-bold text-brand-600">Login to add a delivery address</span>
          )}
        </span>
      </button>
    </section>
  );
}

/** The address picker opened from the cart header and the delivery card. */
function AddressSheet({
  cart,
  isAuthenticated,
  open,
  onOpenChange,
}: {
  cart: FoodCart;
  isAuthenticated: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const setDeliveryAddress = useSetDeliveryAddress();
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: open && isAuthenticated,
  });

  const handleError = (err: unknown) =>
    toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');

  return (
    <BottomSheet title="Select a location" open={open} onOpenChange={onOpenChange}>
      {!isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-900">Add a delivery address to continue</p>
          <Link
            to="/auth/login"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-food-600 py-3 text-sm font-bold text-white transition-colors hover:bg-food-700"
          >
            Login now <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-food-600" />
            <input
              placeholder="Search for area, street name..."
              aria-label="Search location"
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-food-400"
              readOnly
              onClick={() => {
                onOpenChange(false);
                navigate('/food/profile/addresses');
              }}
            />
          </div>

          <div className="overflow-hidden rounded-2xl bg-white">
            <button
              onClick={() => {
                onOpenChange(false);
                navigate('/food/profile/addresses');
              }}
              className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
            >
              <LocateFixed className="h-5 w-5 shrink-0 text-food-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-food-600">Use current location</span>
                <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
                  Set your current location
                </span>
              </span>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
            </button>

            <button
              onClick={() => {
                onOpenChange(false);
                navigate('/food/profile/addresses');
              }}
              className="tap flex w-full items-center gap-3 border-t border-neutral-100 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
            >
              <Plus className="h-5 w-5 shrink-0 text-food-600" />
              <span className="min-w-0 flex-1 text-[15px] font-bold text-food-600">Add Address</span>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
            </button>
          </div>

          {addresses.isLoading && <Skeleton className="h-16 w-full rounded-2xl" />}

          {!addresses.isLoading && (addresses.data ?? []).length > 0 && (
            <section className="mt-2">
              <div className="mb-3 flex items-center gap-3">
                <span aria-hidden className="h-px flex-1 bg-neutral-300" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                  Saved Addresses
                </h3>
                <span aria-hidden className="h-px flex-1 bg-neutral-300" />
              </div>

              <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {(addresses.data ?? []).map((a) => {
                  const active = cart.address_id === a.id;
                  const Icon = a.label === 'Work' ? Briefcase : Home;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setDeliveryAddress.mutate({ addressId: a.id, type: 'food' }, { onError: handleError });
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                        active ? 'border-food-600 bg-food-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                      )}
                    >
                      <span className="flex w-8 shrink-0 flex-col items-center text-neutral-600">
                        <Icon className="h-5 w-5" strokeWidth={1.6} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-900">{a.label}</span>
                          {a.is_default && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Default</span>
                          )}
                        </span>
                        <span className="block text-xs leading-snug text-neutral-600">
                          {a.address_line_1}
                          {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!addresses.isLoading && (addresses.data ?? []).length === 0 && (
            <p className="px-1 text-sm text-neutral-500">No saved addresses. Add one first.</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

/** Zomato's contact row: email and phone in one compact line. */
function ContactCard() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const parts = [
    user.email,
    user.phone ? `${user.country_code ? `${user.country_code}-` : ''}${user.phone}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <Link
      to="/profile/edit"
      className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-white px-4 py-3.5 transition-colors hover:bg-neutral-50"
    >
      {user.phone ? (
        <Phone className="h-4.5 w-4.5 shrink-0 text-neutral-500" />
      ) : (
        <Mail className="h-4.5 w-4.5 shrink-0 text-neutral-500" />
      )}
      <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-neutral-800">
        {parts.join(', ')}
      </p>
      <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
    </Link>
  );
}

/**
 * Zomato's "Total Bill" row: total (with the struck original and the savings
 * chip) and a chevron that expands the full bill breakdown underneath.
 */
function BillCard({ cart }: { cart: FoodCart }) {
  const [open, setOpen] = useState(false);

  const rows: { label: string; value: string; tone?: string }[] = [
    { label: 'Item subtotal', value: cart.subtotal },
  ];

  const saved = parseFloat(cart.discount) || 0;
  if (saved > 0) {
    rows.push({
      label: `Coupon discount${cart.coupon_code ? ` (${cart.coupon_code})` : ''}`,
      value: `-${cart.discount}`,
      tone: 'text-success',
    });
  }
  if (parseFloat(cart.tax) > 0) {
    rows.push({ label: 'Taxes', value: cart.tax });
  }

  const deliveryFee = parseFloat(cart.delivery_fee);
  const hasGst = parseFloat(cart.delivery_gst_amount) > 0;
  const packagingFee = parseFloat(cart.packaging_fee ?? '0');
  const handlingFee = parseFloat(cart.handling_fee ?? '0');
  const originalTotal = parseFloat(cart.total) + saved;

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
      >
        <Receipt className="h-4.5 w-4.5 shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[15px] font-bold text-neutral-900">Total Bill</span>
            {saved > 0 && (
              <span className="text-[13px] text-neutral-400 line-through">
                {formatCurrency(originalTotal)}
              </span>
            )}
            <span className="text-[15px] font-extrabold text-neutral-900">
              {formatCurrency(parseFloat(cart.total))}
            </span>
            {saved > 0 && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">
                You saved {formatCurrency(saved)}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-neutral-500">Incl. taxes, charges &amp; fees</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4.5 w-4.5 shrink-0 text-neutral-400 transition-transform duration-200',
            open && '-rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-neutral-100 px-4 py-3.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">{r.label}</span>
              <span className={cn('font-semibold text-neutral-800', r.tone)}>
                <Price value={r.value} size="sm" />
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-500">Delivery fee</span>
            <span className={cn('font-semibold', deliveryFee === 0 ? 'text-success' : 'text-neutral-800')}>
              {deliveryFee === 0 ? 'Free' : <Price value={cart.delivery_fee} size="sm" />}
            </span>
          </div>
          {packagingFee > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">Packaging charge</span>
              <span className="font-semibold text-neutral-800">
                <Price value={cart.packaging_fee ?? '0'} size="sm" />
              </span>
            </div>
          )}
          {handlingFee > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">Handling fee</span>
              <span className="font-semibold text-neutral-800">
                <Price value={cart.handling_fee ?? '0'} size="sm" />
              </span>
            </div>
          )}
          {hasGst && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">Delivery GST ({Number(cart.delivery_gst_percent)}%)</span>
              <span className="font-semibold text-neutral-800">
                <Price value={cart.delivery_gst_amount} size="sm" />
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type PayMethod = 'wallet' | 'cash_on_delivery' | 'online';

/** The last payment method chosen in the cart, remembered across visits. */
const FOOD_PAY_METHOD_KEY = 'sb-food-pay-method';

function readPayMethod(): PayMethod {
  try {
    const raw = localStorage.getItem(FOOD_PAY_METHOD_KEY);
    if (raw === 'wallet' || raw === 'cash_on_delivery' || raw === 'online') return raw;
  } catch {
    // Storage can be unavailable in private mode; default is fine.
  }
  return 'wallet';
}

/**
 * Zomato's cart footer: the wallet-balance line with "Add money", the
 * `PAY USING` dropdown that opens the payment-options sheet, and the red
 * button carrying the total + `Place Order`. The order is placed right here —
 * Food has no checkout screen; address and payment are both chosen in the cart.
 */
function PaymentBar({ cart, onChooseAddress }: { cart: FoodCart; onChooseAddress: () => void }) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Food preparation instructions are collected above, before placement.
  const foodRestaurantNote = useCartStore((s) => s.foodRestaurantNote);
  const foodNoCutlery = useCartStore((s) => s.foodNoCutlery);
  const clearFoodInstructions = useCartStore((s) => s.clearFoodInstructions);
  const foodDeliveryNote = useCartStore((s) => s.foodDeliveryNote);
  const clearDeliveryNote = useCartStore((s) => s.clearDeliveryNote);

  const [payMethod, setPayMethod] = useState<PayMethod>(readPayMethod);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => repositories.wallet.getWallet(),
    enabled: isAuthenticated,
  });

  const chooseMethod = (m: PayMethod) => {
    setPayMethod(m);
    try {
      localStorage.setItem(FOOD_PAY_METHOD_KEY, m);
    } catch {
      // Not persisting the preference is harmless.
    }
    setSheetOpen(false);
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      const order = await repositories.orders.createOrder({
        order_type: 'food',
        address_id: cart.address_id ?? undefined,
        payment_method: payMethod,
        customer_note: foodDeliveryNote.trim() || undefined,
        restaurant_note: foodRestaurantNote.trim() || undefined,
        send_cutlery: !foodNoCutlery,
      });
      if (payMethod !== 'online') return { order };
      const checkout = await createUsableCheckout(
        (idempotencyKey) =>
          repositories.payments.initiate({
            payable_type: 'order',
            payable_id: order.id,
            payment_method: 'card',
            idempotency_key: idempotencyKey,
          }),
        `checkout:${order.id}`
      );
      return { order, checkout };
    },
    onSuccess: async ({ order, checkout }) => {
      clearFoodInstructions();
      clearDeliveryNote('food');

      if (!checkout) {
        toast('Order placed successfully!');
        navigate(`/order-confirmation/${order.id}`);
        return;
      }

      try {
        const result = await completeOrderPayment(checkout);
        if (result.status === 'paid') {
          toast('Order placed successfully!');
          navigate(`/order-confirmation/${order.id}`);
          return;
        }
        toast('Payment cancelled. You can pay again from the order page.', 'error');
        navigate(`/order/${order.id}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error');
        navigate(`/order/${order.id}`);
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not place order.', 'error'),
  });

  const brand = getBranding().name;
  const hasAddress = !!cart.address_id;
  const pending = placeOrder.isPending;

  const methodLabel =
    payMethod === 'wallet'
      ? `${brand} Wallet`
      : payMethod === 'cash_on_delivery'
        ? 'Cash on delivery'
        : 'Card / UPI';
  const MethodIcon = payMethod === 'wallet' ? WalletIcon : payMethod === 'cash_on_delivery' ? Banknote : CreditCard;

  // With a valid address on the cart (the backend resolves the default one
  // when nothing is picked), the button is straight to Place Order. Only a
  // cart with no usable address at all asks for one — and tapping it opens the
  // existing Food location/address flow rather than a bare selector.
  const cta = !isAuthenticated ? 'Sign in to order' : !hasAddress ? 'Choose address' : 'Place Order';
  const onCta = () => {
    if (pending) return;
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    if (!hasAddress) {
      onChooseAddress();
      return;
    }
    placeOrder.mutate();
  };

  const options: { value: PayMethod; label: string; desc: string; icon: typeof WalletIcon }[] = [
    {
      value: 'wallet',
      label: `${brand} Wallet`,
      desc: wallet.data
        ? `Balance ${formatCurrency(Number(wallet.data.balance))}`
        : 'Pay from your balance',
      icon: WalletIcon,
    },
    { value: 'online', label: 'Card / UPI', desc: 'Pay securely online', icon: CreditCard },
    { value: 'cash_on_delivery', label: 'Cash on delivery', desc: 'Pay when you receive', icon: Banknote },
  ];

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200/70 bg-white/95 pb-safe backdrop-blur md:shadow-[0_-4px_24px_rgb(0_0_0/0.06)]">
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="flex w-full items-center gap-1.5 border-b border-neutral-100 px-[var(--page-gutter)] py-2 text-left text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <WalletIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="min-w-0 truncate">
              {brand} Money Balance:{' '}
              <span className="font-bold text-neutral-900">
                {wallet.data ? formatCurrency(Number(wallet.data.balance)) : '—'}
              </span>
            </span>
            <span className="ml-auto shrink-0 font-bold text-food-600">• Add money</span>
          </button>
        )}

        {isAuthenticated && !hasAddress && (
          <p className="border-b border-neutral-100 px-[var(--page-gutter)] py-2 text-center text-[13px] font-medium text-neutral-600">
            Add a delivery address to place your order.
          </p>
        )}

        <div className="mx-auto flex max-w-5xl items-center gap-3 px-[var(--page-gutter)] py-2.5">
          {/* PAY USING — opens the payment-options sheet. */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className="flex min-w-0 shrink-0 flex-col items-start rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-neutral-50"
          >
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Pay using <ChevronUp className="h-3.5 w-3.5" />
            </span>
            <span className="flex max-w-[8.5rem] items-center gap-1.5 text-[13px] font-semibold text-neutral-800">
              <MethodIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <span className="truncate">{methodLabel}</span>
            </span>
          </button>

          {/* Total + Place Order, one red button as in the reference. */}
          <button
            type="button"
            onClick={onCta}
            disabled={pending}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-3 rounded-xl bg-food-600 px-4 text-white transition-colors hover:bg-food-700 disabled:opacity-60"
          >
            <span className="flex flex-col items-start leading-none">
              <span className="text-[15px] font-extrabold">{formatCurrency(parseFloat(cart.total))}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/80">Total</span>
            </span>
            <span aria-hidden className="h-7 w-px bg-white/30" />
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {cta}
            </span>
          </button>
        </div>
      </div>

      {/* Zomato's payment-options screen, presented as the PAY USING sheet. */}
      <BottomSheet title="Payment options" open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="space-y-2">
          {options.map((o) => {
            const Icon = o.icon;
            const active = payMethod === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => chooseMethod(o.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  active ? 'border-food-600 bg-food-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-food-600 text-white' : 'bg-neutral-100 text-neutral-500'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-neutral-900">{o.label}</span>
                  <span className="block truncate text-xs text-neutral-500">{o.desc}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    active ? 'border-food-600' : 'border-neutral-300'
                  )}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-food-600" />}
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}