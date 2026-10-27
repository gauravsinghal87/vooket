import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Share2,
  ShoppingBag,
  Store as StoreIcon,
  Tag,
  Trash2,
  Zap,
} from 'lucide-react';
import { repositories } from '@/repositories';
import type { Product } from '@/types/catalog';
import type { Address } from '@/types/catalog';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { coordsKey } from '@/lib/geo';
import { useStoreCatalogue } from '@/hooks/useStoreCatalogue';
import {
  useApplyCoupon,
  useCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useSetDeliveryAddress,
  useUpdateCartItem,
} from '@/hooks/useCart';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { SelectedOptionsList } from '@/components/product/selected-options';
import { Card } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Image } from '@/components/ui/image';
import { Rail, SectionHeader } from '@/components/home/section-header';
import { toast } from '@/components/ui/toast';
import { estimateDeliveryMinutes, haversineKm } from '@/lib/geo';
import { getBranding } from '@/lib/branding';
import { cn, formatCurrency } from '@/lib/utils';

type GroceryCart = NonNullable<Awaited<ReturnType<typeof repositories.cart.getByType>>>;
type CartLine = GroceryCart['items'][number];

/**
 * Optional scheduling fields. The cart endpoint does not return them today, but
 * when a scheduled cart does carry them the delivery group must show the booked
 * slot instead of the ASAP estimate.
 */
interface CartSchedule {
  delivery_mode?: string | null;
  scheduled_at?: string | null;
  delivery_slot_id?: number | null;
  slot_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  slot_label?: string | null;
}

function discountPercent(price: string, compareAt: string | null | undefined): number | null {
  const selling = parseFloat(price);
  const mrp = parseFloat(String(compareAt));
  if (!Number.isFinite(selling) || !Number.isFinite(mrp) || mrp <= selling) return null;
  return Math.round(((mrp - selling) / mrp) * 100);
}

function formatSlotDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Blinkit-inspired Grocery checkout cart.
 *
 * Everything on this screen is presentation only: the cart comes from
 * `GET /cart?type=grocery`, quantity / coupon / address changes go through the
 * existing cart hooks, and every amount rendered is the value the backend
 * calculated. No totals, fees or savings are recomputed here.
 */
export function GroceryCartPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const cartQuery = useCart('grocery');
  const cart = cartQuery.data;

  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const setDeliveryAddress = useSetDeliveryAddress();

  const [addressOpen, setAddressOpen] = useState(false);

  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: isAuthenticated,
  });

  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: () => repositories.user.getCoupons(),
    enabled: isAuthenticated && !!cart && cart.items.length > 0,
  });

  const items = cart?.items ?? [];
  const hasItems = !cartQuery.isLoading && !cartQuery.isError && !!cart && items.length > 0;

  const selectedAddress = useMemo<Address | null>(() => {
    const list = addresses.data ?? [];
    if (!cart) return null;
    return list.find((a) => a.id === cart.address_id) ?? list.find((a) => a.is_default) ?? list[0] ?? null;
  }, [addresses.data, cart]);

  /**
   * The store is taken from the cart itself, not from the customer's current
   * location, so the checkout always shows the store the items belong to.
   *
   * Serviceability is still checked against the delivery address of the cart
   * (falling back to the browsing location), so the store row keeps working for
   * a servable address while an unservable one reports no store instead of
   * quietly showing a store that cannot deliver.
   */
  const storeId = items.find((item) => item.product?.store_id)?.product?.store_id ?? null;
  const appLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const addressLatitude =
    selectedAddress?.latitude != null && selectedAddress.latitude !== '' ? Number(selectedAddress.latitude) : NaN;
  const addressLongitude =
    selectedAddress?.longitude != null && selectedAddress.longitude !== '' ? Number(selectedAddress.longitude) : NaN;
  const storeLocation =
    Number.isFinite(addressLatitude) && Number.isFinite(addressLongitude)
      ? { latitude: addressLatitude, longitude: addressLongitude }
      : { latitude: appLocation.latitude, longitude: appLocation.longitude };

  const store = useQuery({
    queryKey: ['store', storeId, coordsKey(storeLocation)],
    queryFn: () => repositories.grocery.getStore(storeId as number, storeLocation),
    enabled: hasItems && storeId !== null,
  });

  // Null when the backend says this location cannot reach the store (see the
  // store query's `serviceability`); the row simply renders without a store.
  const storeData = store.data?.store ?? null;

  const distanceKm = storeData && selectedAddress ? haversineKm(storeData, selectedAddress) : null;
  const etaMin = estimateDeliveryMinutes(distanceKm);

  const schedule = (cart ?? null) as unknown as CartSchedule | null;
  const isScheduled =
    schedule?.delivery_mode === 'scheduled' && !!(schedule.scheduled_at ?? schedule.slot_date);

  const busyItem = (id: number) => updateItem.isPending && updateItem.variables?.itemId === id;
  const feePending = setDeliveryAddress.isPending;

  const handleAddressError = (err: unknown) =>
    toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');

  return (
    <div className="mx-auto w-full max-w-5xl">
      <GroceryCheckoutHeader itemsCount={cart?.items_count ?? 0} />

      {cartQuery.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {cartQuery.isError && (
        <ErrorState
          title="Couldn't load your cart"
          description="Something went wrong while fetching your cart."
          action={{ label: 'Retry', onClick: () => cartQuery.refetch() }}
        />
      )}

      {!cartQuery.isLoading && !cartQuery.isError && !hasItems && (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add groceries from a store to get started."
          action={{ label: 'Browse stores', onClick: () => navigate('/stores') }}
        />
      )}

      {hasItems && cart && (
        <div
          className={cn(
            'space-y-4 pt-3',
            // Clears the fixed CTA (plus the bottom nav and safe-area inset) so
            // the last section is always reachable.
            'pb-[calc(var(--bottom-dock-h)+6rem+env(safe-area-inset-bottom))] md:pb-[calc(var(--bottom-dock-h)+3.5rem)]'
          )}
        >
          <DeliveryGroup
            storeName={storeData?.name ?? null}
            storeLoading={store.isLoading}
            distanceKm={distanceKm}
            etaMin={etaMin}
            scheduled={isScheduled}
            schedule={schedule}
            itemsCount={cart.items_count}
          />

          <CartItemsCard
            cart={cart}
            busyItem={busyItem}
            onQuantity={(itemId, quantity) => updateItem.mutate({ itemId, quantity })}
            onRemove={(itemId) => removeItem.mutate(itemId)}
          />

          <YouMightAlsoLike storeId={storeId} inCartIds={new Set(items.map((i) => i.product_id))} />

          <CouponsSection
            cart={cart}
            coupons={coupons.data ?? []}
            loading={coupons.isLoading}
            isAuthenticated={isAuthenticated}
          />

          <BillDetails cart={cart} feePending={feePending} />

          <DeliverToRow
            cart={cart}
            address={selectedAddress}
            loading={addresses.isLoading || store.isLoading}
            busy={feePending}
            onOpen={() => setAddressOpen(true)}
            onClear={() =>
              setDeliveryAddress.mutate({ addressId: null, type: 'grocery' }, { onError: handleAddressError })
            }
          />

          <BottomSheet title="Select delivery address" open={addressOpen} onOpenChange={setAddressOpen}>
            <div className="space-y-2">
              {addresses.isLoading && <Skeleton className="h-16 w-full rounded-2xl" />}

              {!addresses.isLoading && (addresses.data ?? []).length === 0 && (
                <p className="px-1 text-sm text-neutral-500">No saved addresses. Add one first.</p>
              )}

              {(addresses.data ?? []).map((a) => {
                const active = cart.address_id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      setDeliveryAddress.mutate(
                        { addressId: a.id, type: 'grocery' },
                        { onError: handleAddressError }
                      );
                      setAddressOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                      active ? 'border-grocery-500 bg-grocery-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        active ? 'border-grocery-600' : 'border-neutral-300'
                      )}
                    >
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-grocery-600" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900">{a.label}</span>
                        {a.is_default && (
                          <span className="rounded-full bg-grocery-100 px-2 py-0.5 text-[10px] font-semibold text-grocery-800">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {a.address_line_1}
                        {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city} {a.postal_code}
                      </span>
                    </span>
                  </button>
                );
              })}

              <Link
                to="/profile/addresses"
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 p-3 text-sm font-semibold text-grocery-700 transition-colors hover:border-grocery-300"
              >
                <Plus className="h-4 w-4" /> Add new address
              </Link>
            </div>
          </BottomSheet>

          <GroceryCheckoutBar cart={cart} feePending={feePending} onCheckout={() => navigate('/checkout?type=grocery')} />
        </div>
      )}
    </div>
  );
}

/**
 * Compact checkout header: back, title, share. No logo, no location and no
 * store row, so the store/location are presented exactly once further down.
 */
function GroceryCheckoutHeader({ itemsCount }: { itemsCount: number }) {
  const navigate = useNavigate();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = () => {
    navigator
      .share({ title: `My ${getBranding().name} grocery cart`, url: window.location.href })
      .catch(() => undefined);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-grocery-200 bg-grocery-50/95 backdrop-blur">
      <div className="mx-auto max-w-5xl px-[var(--page-gutter)]">
        <div className="flex h-14 items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="tap -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-grocery-200/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-ink-900">
              Checkout
            </h1>
            {itemsCount > 0 && (
              <p className="truncate text-[11px] font-medium text-neutral-500">
                Shipment of {itemsCount} item{itemsCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {canShare && (
            <button
              type="button"
              aria-label="Share cart"
              onClick={share}
              className="tap -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-grocery-200/60"
            >
              <Share2 className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Delivery group: the real delivery promise for this cart. A scheduled cart
 * shows its booked slot, an ASAP cart shows the estimate derived from the real
 * store-to-address distance, and a cart without usable distance data says so
 * instead of guessing.
 */
function DeliveryGroup({
  storeName,
  storeLoading,
  distanceKm,
  etaMin,
  scheduled,
  schedule,
  itemsCount,
}: {
  storeName: string | null;
  storeLoading: boolean;
  distanceKm: number | null;
  etaMin: number | null;
  scheduled: boolean;
  schedule: CartSchedule | null;
  itemsCount: number;
}) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grocery-100 text-grocery-700">
        {scheduled ? <CalendarClock className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight tracking-tight text-neutral-900">
          {scheduled
            ? 'Scheduled'
            : etaMin !== null
              ? `Delivery in ${etaMin} min`
              : 'Delivery time shown at checkout'}
        </p>

        {scheduled ? (
          <p className="mt-0.5 truncate text-[11px] text-neutral-500">
            {schedule?.scheduled_at
              ? new Date(schedule.scheduled_at).toLocaleString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : schedule?.slot_label ??
                [formatSlotDay(schedule?.slot_date ?? ''), `${schedule?.start_time ?? ''} – ${schedule?.end_time ?? ''}`]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[11px] text-neutral-500">
            Shipment of {itemsCount} item{itemsCount === 1 ? '' : 's'}
          </p>
        )}

        <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-grocery-800">
          <StoreIcon className="h-3 w-3 shrink-0" />
          {storeLoading ? 'Loading store…' : (storeName ?? 'Your grocery store')}
          {distanceKm !== null && <span className="font-medium text-neutral-500">· {distanceKm.toFixed(1)} km</span>}
        </p>
      </div>

      <span className="shrink-0 rounded-full bg-grocery-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-grocery-800">
        {scheduled ? 'Slot' : 'ASAP'}
      </span>
    </Card>
  );
}

function CartItemsCard({
  cart,
  busyItem,
  onQuantity,
  onRemove,
}: {
  cart: GroceryCart;
  busyItem: (id: number) => boolean;
  onQuantity: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">Shipment of {cart.items_count} item{cart.items_count === 1 ? '' : 's'}</h2>
      </div>

      <Card className="divide-y divide-neutral-100 p-0">
        {cart.items.map((item) => (
          <GroceryCartLine
            key={item.id}
            item={item}
            busy={busyItem(item.id)}
            onQuantity={(quantity) => onQuantity(item.id, quantity)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </Card>
    </section>
  );
}

function GroceryCartLine({
  item,
  busy,
  onQuantity,
  onRemove,
}: {
  item: CartLine;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const name = item.product?.name ?? 'Item';
  const off = discountPercent(item.line_total, null);
  const unitOff = discountPercent(item.unit_price, item.product?.compare_at_price);

  return (
    <div className="flex gap-3 p-3.5">
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
        <Image src={item.product?.image} alt={name} className="h-full w-full object-contain" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold tracking-tight text-neutral-900" title={name}>
              {name}
            </p>
            {item.product?.unit_label && (
              <p className="text-[11px] text-neutral-500">{item.product.unit_label}</p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            disabled={busy}
            className={cn(
              'shrink-0 rounded-full p-1 text-neutral-300 transition-colors hover:text-danger disabled:opacity-40',
              busy && 'pointer-events-none'
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {item.selected_options && item.selected_options.length > 0 && (
          <SelectedOptionsList options={item.selected_options} inline className="mt-1" />
        )}

        <p className="mt-1 text-[11px] text-neutral-500">
          <Price value={item.unit_price} size="sm" />
          <span className="text-neutral-400"> × {item.quantity}</span>
          {unitOff !== null && (
            <span className="ml-1.5 font-bold text-success">{unitOff}% off</span>
          )}
        </p>

        <div className="mt-2 flex items-end justify-between gap-2">
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-grocery-600" />
          ) : (
            <QuantityStepper size="sm" value={item.quantity} onChange={onQuantity} />
          )}

          <div className="min-w-0 text-right">
            <p className="text-[14px] font-extrabold leading-tight text-neutral-900">
              <Price value={item.line_total} size="md" />
            </p>
            {item.product?.compare_at_price && (
              <p className="text-[11px] leading-tight text-neutral-400">
                MRP {formatCurrency(Number(item.product.compare_at_price) * item.quantity)}
              </p>
            )}
            {off !== null && <p className="text-[11px] font-bold text-success">{off}% off</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Recommendations come from the same store-scoped catalogue endpoint the grocery
 * pages already use, so the cart only makes one extra request and never mixes
 * products from another store.
 */
function YouMightAlsoLike({ storeId, inCartIds }: { storeId: number | null; inCartIds: Set<number> }) {
  const { products, isLoading } = useStoreCatalogue(storeId, { perPage: 24 });

  const suggestions = useMemo(
    () => products.filter((p) => p.is_available && !inCartIds.has(p.id)).slice(0, 10),
    [products, inCartIds]
  );

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="You might also like"
        to="/grocery"
        actionLabel="See all products"
        className="mb-2 px-0.5"
      />

      {isLoading && suggestions.length === 0 ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-[132px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <Rail>
          {suggestions.map((product) => (
            <RecommendationCard key={product.id} product={product} />
          ))}
        </Rail>
      )}
    </section>
  );
}

function RecommendationCard({ product }: { product: Product }) {
  const off = discountPercent(product.price, product.compare_at_price);

  return (
    <div className="flex w-[132px] shrink-0 snap-start flex-col rounded-2xl border border-neutral-200 bg-white p-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
        <Image src={product.image} alt={product.name} className="h-full w-full object-contain" />
        {off !== null && (
          <span className="absolute left-1 top-1 rounded-md bg-success px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            {off}% off
          </span>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-tight text-neutral-900" title={product.name}>
        {product.name}
      </p>
      {product.unit_label && <p className="text-[10px] text-neutral-500">{product.unit_label}</p>}

      <p className="mt-1 text-[13px] font-extrabold text-neutral-900">
        <Price value={product.price} size="sm" compareAt={product.compare_at_price} />
      </p>

      <div className="mt-1.5">
        <AddToCartControl productId={product.id} type="grocery" size="sm" product={product} />
      </div>
    </div>
  );
}

function CouponsSection({
  cart,
  coupons,
  loading,
  isAuthenticated,
}: {
  cart: GroceryCart;
  coupons: Awaited<ReturnType<typeof repositories.user.getCoupons>>;
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

  const shown = coupons.slice(0, 2);
  const discount = parseFloat(cart.discount);
  const deliveryFee = parseFloat(cart.delivery_fee);

  return (
    <section>
      <h2 className="mb-1.5 px-0.5 text-[15px] font-extrabold tracking-tight text-neutral-900">Coupons &amp; offers</h2>

      {!isAuthenticated ? (
        <Card className="p-3.5">
          <p className="text-sm font-semibold text-neutral-900">Apply a coupon</p>
          <p className="mt-0.5 text-xs text-neutral-500">Login to apply coupons and save on this order.</p>
          <Link
            to="/auth/login"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-grocery-700 hover:underline"
          >
            Login now <ChevronRight className="h-3 w-3" />
          </Link>
        </Card>
      ) : (
        <Card className="divide-y divide-neutral-100 p-0">
          {cart.coupon_code ? (
            <div className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-neutral-900">Coupon applied</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {cart.coupon_code}
                    {discount > 0 && ` · you saved ${formatCurrency(cart.discount)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeCoupon.mutate()}
                className="shrink-0 text-xs font-bold text-danger hover:underline"
              >
                Remove
              </button>
            </div>
          ) : loading ? (
            <Skeleton className="m-3 h-12 rounded-xl" />
          ) : (
            <>
              {deliveryFee === 0 && (
                <div className="flex items-center gap-2.5 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-grocery-100 text-grocery-700">
                    <Tag className="h-4 w-4" />
                  </span>
                  <p className="text-[13px] font-semibold text-neutral-800">
                    Yay! You got <span className="font-extrabold text-grocery-800">FREE delivery</span>
                  </p>
                </div>
              )}

              {shown.map((coupon) => (
                <div key={coupon.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-neutral-900">{coupon.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                      {coupon.description ?? `Use code ${coupon.code}`}
                    </p>
                  </div>
                  <button
                    onClick={() => applyCode(coupon.code)}
                    disabled={applyCoupon.isPending}
                    className="shrink-0 rounded-full bg-grocery-500 px-3 py-1.5 text-[12px] font-extrabold text-ink-900 transition-colors hover:bg-grocery-400 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </>
          )}

          <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2.5 p-3.5 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <Tag className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[13px] font-semibold text-neutral-800">
              {cart.coupon_code ? 'Change coupon' : 'Apply coupon'}
            </span>
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
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal transition-colors focus:border-grocery-500 focus:outline-none focus:ring-2 focus:ring-grocery-500/25"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-grocery-500 text-ink-900 hover:bg-grocery-400"
              disabled={!code.trim() || applyCoupon.isPending}
            >
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
                  className="flex w-full items-start gap-3 rounded-2xl border border-neutral-200 p-3 text-left transition-colors hover:border-grocery-300"
                >
                  <span className="rounded-lg bg-grocery-100 px-2 py-1 text-[11px] font-extrabold tracking-wide text-grocery-800">
                    {coupon.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-neutral-900">{coupon.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                      {coupon.description}
                      {parseFloat(coupon.min_order_amount) > 0 &&
                        ` · Min. order ${formatCurrency(Number(coupon.min_order_amount))}`}
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
 * Every row here is a value the backend already calculated for this cart.
 */
function BillDetails({ cart, feePending }: { cart: GroceryCart; feePending: boolean }) {
  const discount = parseFloat(cart.discount);
  const tax = parseFloat(cart.tax);
  const deliveryFee = parseFloat(cart.delivery_fee);
  const deliveryGst = parseFloat(cart.delivery_gst_amount);

  return (
    <Card className="p-3.5">
      <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-neutral-900">Bill details</h2>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-500">Items total</span>
          <span className="font-semibold text-neutral-800">
            <Price value={cart.subtotal} size="sm" />
          </span>
        </div>

        {discount > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-500">
              Coupon discount{cart.coupon_code ? ` (${cart.coupon_code})` : ''}
            </span>
            <span className="font-semibold text-success">-{formatCurrency(cart.discount)}</span>
          </div>
        )}

        {tax > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-500">Taxes</span>
            <span className="font-semibold text-neutral-800">
              <Price value={cart.tax} size="sm" />
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-500">Delivery charge</span>
          {feePending ? (
            <span className="flex items-center gap-1.5 font-semibold text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
            </span>
          ) : deliveryFee === 0 ? (
            <span className="font-extrabold uppercase tracking-wide text-success">FREE</span>
          ) : (
            <span className="font-semibold text-neutral-800">
              <Price value={cart.delivery_fee} size="sm" />
            </span>
          )}
        </div>

        {!feePending && deliveryGst > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-500">Delivery GST ({Number(cart.delivery_gst_percent)}%)</span>
            <span className="font-semibold text-neutral-800">
              <Price value={cart.delivery_gst_amount} size="sm" />
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-neutral-200 pt-2.5">
          <span className="text-[15px] font-extrabold text-neutral-900">Grand total</span>
          {feePending ? (
            <span className="text-base font-extrabold text-neutral-400">Calculating…</span>
          ) : (
            <span className="text-lg font-extrabold tracking-tight text-neutral-900">
              <Price value={cart.total} />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function DeliverToRow({
  cart,
  address,
  loading,
  busy,
  onOpen,
  onClear,
}: {
  cart: GroceryCart;
  address: Address | null;
  loading: boolean;
  busy: boolean;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="p-3.5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Delivering to</p>
        {!loading && address && (
          <div className="flex items-center gap-3">
            {cart.address_id && (
              <button onClick={onClear} className="text-xs font-medium text-neutral-400 hover:text-neutral-600">
                Clear
              </button>
            )}
            <button onClick={onOpen} className="text-xs font-bold text-grocery-700 hover:text-grocery-800">
              Change
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : address ? (
        <button onClick={onOpen} className="flex w-full items-start gap-3 text-left">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-grocery-600" />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-neutral-900">{address.label}</span>
              {address.is_default && (
                <span className="rounded-full bg-grocery-100 px-2 py-0.5 text-[10px] font-semibold text-grocery-800">
                  Default
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-neutral-500">
              {address.address_line_1}
              {address.address_line_2 ? `, ${address.address_line_2}` : ''}, {address.city} {address.postal_code}
            </span>
            {busy && (
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-grocery-700">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating delivery fee…
              </span>
            )}
          </span>
        </button>
      ) : (
        <button onClick={onOpen} className="flex w-full items-center gap-2 text-sm font-semibold text-neutral-700">
          <MapPin className="h-4 w-4 text-neutral-400" />
          Select delivery address
          <span className="ml-auto text-xs font-bold text-grocery-700">Choose</span>
        </button>
      )}
    </Card>
  );
}

function GroceryCheckoutBar({
  cart,
  feePending,
  onCheckout,
}: {
  cart: GroceryCart;
  feePending: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom))] z-30 border-t border-grocery-200 bg-white/95 pb-2 pt-1.5 backdrop-blur md:shadow-[0_-4px_24px_rgb(0_0_0/0.06)]">
      <div className="mx-auto max-w-5xl px-[var(--page-gutter)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
            <Clock className="h-3 w-3" /> Total payable
          </span>
          {feePending ? (
            <span className="text-base font-extrabold text-neutral-400">Calculating…</span>
          ) : (
            <span className="text-base font-extrabold tracking-tight text-neutral-900">
              <Price value={cart.total} />
            </span>
          )}
        </div>

        <Button
          onClick={onCheckout}
          className="mt-1.5 h-11 w-full gap-1.5 rounded-xl bg-grocery-500 text-[13px] font-extrabold text-ink-900 shadow-sm hover:bg-grocery-400"
        >
          Choose address at next step <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
