import { useLayoutEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, HelpCircle, Loader2, MapPin, RefreshCw, Star, Truck, X, XCircle } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { useRealtimeOrder, useRealtimeTracking } from '@/shared/services/realtime';
import { TrackingHeader } from '@/features/orders/components/tracking-header';
import { TrackingCard } from '@/features/orders/components/tracking-card';
import { OrderTrackingPromo } from '@/features/orders/components/order-tracking-promo';
import { OrderTrackingMap } from '@/features/orders/components/TrackingMap';
import { DeliveryPartnerPanel } from '@/features/orders/components/delivery-partner-panel';
import { DeliveryOtpCard } from '@/features/orders/components/delivery-otp-card';
import { DeliveryScheduleCard } from '@/features/orders/components/delivery-schedule-card';
import { PayNowCard } from '@/features/orders/components/pay-now-card';
import { CashCollectedCard, PaymentReceivedCard } from '@/features/orders/components/payment-received-card';
import { isTerminalStatus, orderStatusHeading } from '@/shared/utils/orderStatus';
import { formatEta, isTrackingActive } from '@/shared/utils/orderTracking';
import { apiClient } from '@/shared/services/apiClient';
import { Card } from '@/shared/components/ui/card';
import { Price } from '@/shared/components/ui/price';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { SelectedOptionsList } from '@/shared/components/product/selected-options';
import { toast } from '@/shared/components/ui/toast';
import { useTrackingHeaderStore } from '@/features/orders/store/trackingHeaderStore';
import { cn, isOrderPaid, isOrderPastVendorAcceptance } from '@/shared/utils/utils';
import type { Order, PreparationInstructionsPayload } from '@/shared/types/models';

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const queryClient = useQueryClient();

  const {
    data: initial,
    isError,
    isFetchedAfterMount,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repositories.orders.getOrder(orderId),
    enabled: Number.isFinite(orderId),
    retry: false,
  });
  const { data: liveOrder } = useRealtimeOrder(orderId);
  const { data: tracking } = useRealtimeTracking(orderId);

  const order = liveOrder ?? initial;
  const orderServiceType = String(order?.order_type) === 'grocery' ? 'grocery' : String(order?.order_type) === 'ride' ? 'ride' : 'food';
  const getDefaultCategory = (type: string) => {
    if (type === 'grocery') return 'missing_item';
    if (type === 'ride') return 'fare_discrepancy';
    return 'food_quality';
  };

  const [rateOpen, setRateOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportCategory, setSupportCategory] = useState('food_quality');
  const [supportSubcategory, setSupportSubcategory] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportDestination] = useState('wallet');
  const [supportAmount, setSupportAmount] = useState('');
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // The order's service decides which Admin-managed promo carousel renders
  // (Food vs Grocery). Keyed by service so React Query dedupes and caches each
  // service's `order_tracking` placement, and a Food promo can never bleed into
  // a Grocery order.
  const orderService: 'food' | 'grocery' = order?.order_type === 'grocery' ? 'grocery' : 'food';

  // The whole order page is service-themed: while an order is loaded the page
  // publishes its service to the shared app header so the header and the
  // tracking hero beneath it paint one continuous Food red / Grocery gold band,
  // with no dark strip between them in either the collapsed or expanded map
  // state. A layout effect (not a passive one) applies it before paint so the
  // header never flashes its normal dark colour first. The value resets to null
  // on unmount, so every other route keeps the dark header untouched.
  const setTrackingHeaderTheme = useTrackingHeaderStore((s) => s.setTheme);
  const hasOrder = Boolean(order);
  useLayoutEffect(() => {
    setTrackingHeaderTheme(hasOrder ? orderService : null);
    return () => setTrackingHeaderTheme(null);
  }, [hasOrder, orderService, setTrackingHeaderTheme]);

  const { data: trackingBanners, isLoading: bannersLoading } = useQuery({
    queryKey: ['banners', 'order_tracking', orderService],
    queryFn: () => repositories.banners.getByPlacement(orderService, 'order_tracking'),
    enabled: Boolean(order),
    staleTime: 5 * 60 * 1000,
  });
  // Strict placement match also drops the shared all/null banners the endpoint
  // returns, so only order-tracking promos ever render in the carousel.
  const promoBanners = (trackingBanners ?? []).filter((b) => b.placement === 'order_tracking');

  const { data: prep } = useQuery<PreparationInstructionsPayload>({
    queryKey: ['order', orderId, 'preparation'],
    queryFn: () => repositories.orders.getPreparationInstructions(orderId),
    enabled: Number.isFinite(orderId) && order?.order_type === 'food',
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => repositories.orders.cancelOrder(orderId, 'Customer requested'),
    onSuccess: () => {
      toast('Order cancelled');
      setConfirmCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: () => toast('Could not cancel order', 'error'),
  });

  const reorder = useMutation({
    mutationFn: () => repositories.orders.reorder(orderId),
    onSuccess: (newOrder) => {
      toast('Items added to cart');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      window.location.href = newOrder.order_type === 'grocery' ? '/cart?type=grocery' : '/cart';
    },
    onError: () => toast('Could not reorder', 'error'),
  });

  const rate = useMutation({
    mutationFn: () => repositories.orders.rateOrder(orderId, rating, comment || undefined),
    onSuccess: () => {
      toast('Thanks for your rating!');
      setRateOpen(false);
    },
    onError: () => toast('Could not submit rating', 'error'),
  });

  const mapsApiKey: string | null = null;

  if (!order) {
    if (isError) {
      return (
        <div className="mx-auto max-w-2xl space-y-3 px-[var(--page-gutter)] pt-4">
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <XCircle className="h-10 w-10 text-danger" />
            <p className="text-lg font-extrabold text-neutral-900">Order not found</p>
            <p className="text-sm text-neutral-500">This order was removed or is no longer available.</p>
            <div className="mt-3 flex gap-2">
              <Link to="/orders">
                <Button variant="outline">Back to orders</Button>
              </Link>
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-[var(--page-gutter)] pt-4">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const tone: 'brand' | 'food' | 'grocery' = order.order_type === 'grocery' ? 'grocery' : 'food';
  const pastVendorAcceptance = isOrderPastVendorAcceptance(order.status);
  // Only expose Cancel/Reorder once we have a fresh status for this mount, so a
  // cached (stale) status can never briefly show actions the vendor acceptance
  // has since prohibited. `useRealtimeOrder` always fetches on mount.
  const statusFresh = Boolean(liveOrder) || isFetchedAfterMount;
  const cancellable = !isCancelled && !pastVendorAcceptance && statusFresh;
  const canReorder = !pastVendorAcceptance && statusFresh;

  const heading = orderStatusHeading(order.status, order.order_type);
  const restaurantName =
    order.restaurant?.name ??
    order.store?.name ??
    tracking?.order?.pickup?.name ??
    (order.order_type === 'grocery' ? 'Your store' : 'Your restaurant');
  const restaurantLogo = order.restaurant?.logo ?? order.store?.logo ?? null;
  const restaurantLink = order.restaurant
    ? `/restaurant/${order.restaurant.id}`
    : order.store
      ? `/store/${order.store.id}`
      : null;
  const etaLabel = formatEta(tracking?.eta ?? null);
  const showTracking = Boolean(tracking && isTrackingActive(tracking));
  // Hide the delivery-partner card once the order is delivered, using the
  // canonical backend status (never the presence/absence of location data).
  // Scoped to Food tracking so Grocery behaviour is untouched.
  const partnerCardVisible =
    Boolean(tracking?.partner) && !isCancelled && !(tone === 'food' && isTerminalStatus(order.status));

  const openSupport = () => {
    setSupportError(null);
    setSupportSuccess(null);
    setSupportSubcategory('');
    setSupportSubject('');
    setSupportDescription('');
    setSupportAmount('');
    setSupportCategory(getDefaultCategory(orderServiceType));
    setSupportOpen(true);
  };

  const submitSupport = async () => {
    if (!order) return;
    setSupportSubmitting(true);
    setSupportError(null);
    try {
      const formData = new FormData();
      formData.append('ticket_type', 'order');
      formData.append('subject', supportSubject.trim() || `${order.order_number} support request`);
      formData.append('description', supportDescription.trim());
      formData.append('reference_type', 'order');
      formData.append('reference_id', String(order.id));
      formData.append('issue_category', supportCategory);
      if (supportSubcategory) formData.append('subcategory', supportSubcategory);
      formData.append('refund_destination', supportDestination);
      if (supportAmount) formData.append('requested_refund_amount', supportAmount);
      // attachments
      supportFiles.slice(0, 5).forEach((file) => {
        if (file.size > 5 * 1024 * 1024) return;
        formData.append('attachments[]', file);
      });
      const res = await apiClient.post<{ ticket_number?: string }>('/support-tickets', formData);
      setSupportSuccess(`Request submitted (${(res as any)?.ticket_number ?? ''}). Our team will review it.`);
      setSupportDescription('');
      setSupportAmount('');
      setSupportSubject('');
      setSupportSubcategory('');
      setSupportFiles([]);
    } catch (e) {
      setSupportError(e instanceof Error ? e.message : 'Failed to submit support request');
    } finally {
      setSupportSubmitting(false);
    }
  };

  const hasPromos = promoBanners.length > 0;
  const showBanner = hasPromos || bannersLoading;
  // Expanded-map mode is only reachable when the tracking section actually shows
  // a live map (active tracking + a browser key); otherwise the expand
  // affordance is absent and the page always renders the collapsed layout.
  const mapAvailable = Boolean(showTracking && mapsApiKey);
  // Single source of truth for the layout: the banner + compact card and the
  // expanded header + full map are two states of the same `isMapExpanded` value,
  // so they always switch together.
  const showExpandedMap = isMapExpanded && mapAvailable;

  return (
    <div data-order-tracking className="pb-2">
      <div>
        {showExpandedMap ? (
          /* Expanded-map mode — a distinct layout state. The promo carousel and
             the compact tracking card are unmounted, and a single compact themed
             header + full map takes their place. The block fills the viewport
             between the app header and the bottom navigation (hidden on
             desktop), so no blank page surface shows above the map and the map
             never slides under the nav. Header and map share one continuous
             themed surface — Food red or Grocery gold — with no nested panel,
             border, shadow or gap between them. */
          <div
            data-map-expanded
            className="bg-ink-950"
          >
            {/* Compact themed header: restaurant/store name, live status, ETA,
                collapse control and refresh — the same real payload as the
                collapsed card. */}
            <TrackingHeader
              orderType={order.order_type}
              restaurantName={restaurantName}
              heading={heading}
              etaLabel={etaLabel}
              cancelled={isCancelled}
              refreshing={isFetching}
              onRefresh={() => refetch()}
              onCollapse={() => setIsMapExpanded(false)}
            />

            {/* The real map, directly below the header, at ~45–50% of viewport
                height so details remain visible below it. Route, markers and
                controls come from the existing tracking map instance; the map
                resizes on state changes via its ResizeObserver. */}
            <div className="relative h-[clamp(320px,48vh,440px)] w-full overflow-hidden bg-ink-950 md:h-[clamp(360px,48vh,460px)]">
              <OrderTrackingMap tracking={tracking!} apiKey={mapsApiKey!} tone={tone} className="absolute inset-0 h-full w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Admin-managed promo carousel — full-bleed, directly under the app
                header. Placement is resolved for the order's service, so Food
                promos never bleed into Grocery and vice versa. */}
            {showBanner && <OrderTrackingPromo banners={promoBanners} loading={bannersLoading} />}

            {/* Compact Zomato-style tracking card, pulled up to overlap the
                banner's bottom edge. Its mini-map is the only Google Maps
                instance in this state, so the two layouts never double-mount the
                map; the card simply drops the map column when none is available. */}
            <div
              className={cn(
                'relative z-10 mx-auto w-full max-w-2xl px-[var(--page-gutter)]',
                showBanner && '-mt-5'
              )}
            >
              <TrackingCard
                orderType={order.order_type}
                restaurantName={restaurantName}
                restaurantLogo={restaurantLogo}
                heading={heading}
                etaLabel={etaLabel}
                cancelled={isCancelled}
                map={
                  mapAvailable ? (
                    <OrderTrackingMap
                      tracking={tracking!}
                      apiKey={mapsApiKey!}
                      tone={tone}
                      className="absolute inset-0 h-full w-full"
                    />
                  ) : undefined
                }
                onExpand={mapAvailable ? () => setIsMapExpanded(true) : undefined}
              />
            </div>
          </>
        )}

        {/* C. Delivery partner panel directly below the tracking card (only while dispatching). */}
        {partnerCardVisible && <DeliveryPartnerPanel tracking={tracking!} tone={tone} />}

        {/* D. Order details. */}
        <div className="mx-auto w-full max-w-2xl space-y-3 px-[var(--page-gutter)] pb-2 pt-3">
          {/* Payment card sits immediately before the Delivery OTP card. */}
          {!isCancelled &&
            (order.delivery_payment_collected_at ? (
              <CashCollectedCard order={order} />
            ) : order.payment_method === 'online' || order.payment_method === 'cash_on_delivery' ? (
              isOrderPaid(order.payment_status) ? (
                <PaymentReceivedCard order={order} />
              ) : (
                <PayNowCard order={order} tone={tone} />
              )
            ) : null)}

          <DeliveryOtpCard
            orderId={orderId}
            tone={tone}
            active={
              ['food', 'grocery'].includes(order.order_type) &&
              ['OUT_FOR_DELIVERY', 'ARRIVED'].includes(order.status) &&
              !order.delivery_otp_verified_at
            }
          />

          <RestaurantSummary
            order={order}
            tone={tone}
            restaurantName={restaurantName}
            restaurantLogo={restaurantLogo}
            restaurantLink={restaurantLink}
            prep={prep}
          />

          {order.order_type === 'grocery' && <DeliveryScheduleCard order={order} />}

          <AddressCard order={order} tone={tone} />

          <BillCard order={order} />

          <div className="flex flex-wrap gap-2 pt-1">
            {order.help_available !== false && (
              <Button variant="outline" size="sm" onClick={openSupport}>
                <HelpCircle className="h-4 w-4" /> Get help
              </Button>
            )}
            {cancellable && (
              <Button variant="danger" size="sm" onClick={() => setConfirmCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancel order
              </Button>
            )}
            {canReorder && (
              <Button variant="outline" size="sm" onClick={() => reorder.mutate()} disabled={reorder.isPending}>
                {reorder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reorder
              </Button>
            )}
            {!isCancelled && order.status === 'DELIVERED' && (
              <Button variant={tone === 'food' ? 'accent' : tone === 'grocery' ? 'grocery' : 'default'} size="sm" onClick={() => setRateOpen(true)}>
                <Star className="h-4 w-4" /> Rate order
              </Button>
            )}
          </div>
        </div>
      </div>

      <BottomSheet title="Cancel this order?" open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            This will cancel your order and start any eligible refund. This can't be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmCancelOpen(false)}>
              Keep order
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel order
            </Button>
          </div>
        </div>
      </BottomSheet>

      {supportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">Get help with this order</h2>
              <button type="button" onClick={() => setSupportOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              Order {order?.order_number} · {restaurantName} · {order ? `₹${order.total_amount}` : ''}
            </p>
            {supportSuccess ? (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{supportSuccess}</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Issue category</label>
                  <select
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                  >
                    {orderServiceType === 'grocery' ? (
                      <>
                        <option value="missing_item">Missing item</option>
                        <option value="wrong_item">Wrong item delivered</option>
                        <option value="damaged_spilled">Item damaged or spoiled</option>
                        <option value="quantity_pricing">Quantity or pricing discrepancy</option>
                        <option value="partial_fulfillment">Partial fulfillment / out of stock</option>
                        <option value="not_received">Order not received</option>
                        <option value="payment_refund">Payment or refund issue</option>
                        <option value="other">Other issue</option>
                      </>
                    ) : orderServiceType === 'ride' ? (
                      <>
                        <option value="driver_conduct">Driver conduct issue</option>
                        <option value="fare_discrepancy">Fare discrepancy</option>
                        <option value="ride_cancellation">Ride cancellation</option>
                        <option value="safety_issue">Safety issue</option>
                        <option value="route_trip">Route or trip problem</option>
                        <option value="not_received">Trip issue</option>
                        <option value="payment_refund">Payment or refund issue</option>
                        <option value="other">Other issue</option>
                      </>
                    ) : (
                      <>
                        <option value="food_quality">Food quality or taste issue</option>
                        <option value="missing_item">Missing item</option>
                        <option value="wrong_item">Wrong item delivered</option>
                        <option value="damaged_spilled">Item damaged or spilled</option>
                        <option value="not_received">Order marked delivered but not received</option>
                        <option value="late_incomplete">Late or incomplete delivery</option>
                        <option value="payment_refund">Payment or refund issue</option>
                        <option value="other">Other order-related issue</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Subject (optional)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder="Brief summary of the issue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
                  <textarea
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    rows={4}
                    value={supportDescription}
                    onChange={(e) => setSupportDescription(e.target.value)}
                    placeholder="Please describe the issue in detail, including relevant items/times if possible"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Add photos (optional)</label>
                  <p className="mb-2 text-xs text-neutral-500">
                    {orderServiceType === 'ride'
                      ? 'Attach photos only if relevant to your complaint (e.g., vehicle condition).'
                      : orderServiceType === 'grocery'
                      ? 'Attach photos of damaged/spoiled products, wrong items, or packaging issues.'
                      : 'Attach photos of damaged/spoiled food, wrong items, or missing items.'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="w-full text-sm"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const valid = files
                        .filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024)
                        .slice(0, 5);
                      setSupportFiles(valid);
                    }}
                  />
                  {supportFiles.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {supportFiles.map((file, idx) => (
                        <div key={idx} className="relative overflow-hidden rounded-lg border border-neutral-200">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-20 w-full object-cover"
                          />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-black/60 px-1 text-xs text-white"
                            onClick={() => setSupportFiles((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Requested refund amount (optional)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={supportAmount}
                    onChange={(e) => setSupportAmount(e.target.value)}
                    placeholder="Leave blank for full review"
                  />
                </div>
                {supportError && <p className="text-sm text-red-600">{supportError}</p>}
                <p className="text-xs text-neutral-500">
                  Requesting a refund does not mean it has been approved. Our team will review your request and may ask for more details.
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSupportOpen(false)}>Close</Button>
              {!supportSuccess && (
                <Button onClick={submitSupport} disabled={supportSubmitting || !supportDescription.trim()}>
                  {supportSubmitting ? 'Submitting…' : 'Submit request'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomSheet title="Rate your order" open={rateOpen} onOpenChange={setRateOpen}>
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
                <Star
                  className={cn(
                    'h-9 w-9 transition-transform',
                    n <= rating ? 'fill-warning text-warning' : 'text-neutral-200 hover:scale-110'
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={3}
            className="w-full rounded-2xl border border-neutral-200 bg-white p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Button className="w-full" onClick={() => rate.mutate()} disabled={rate.isPending}>
            {rate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function RestaurantSummary({
  order,
  tone,
  restaurantName,
  restaurantLogo,
  restaurantLink,
  prep,
}: {
  order: Order;
  tone: 'brand' | 'food' | 'grocery';
  restaurantName: string;
  restaurantLogo: string | null;
  restaurantLink: string | null;
  prep?: PreparationInstructionsPayload;
}) {
  const linkTone =
    tone === 'food' ? 'text-food-600' : tone === 'grocery' ? 'text-grocery-700' : 'text-brand-600';
  const instructions = prep?.instructions;
  const hasInstructions =
    !!instructions &&
    (instructions.selected.length > 0 || !!instructions.restaurant_note || instructions.send_cutlery === false);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          {restaurantLogo ? (
            <img src={restaurantLogo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Truck className="h-5 w-5 text-neutral-400" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neutral-900">{restaurantName}</p>
          <p className="text-xs text-neutral-500">
            Order {order.order_number} · {new Date(order.created_at).toLocaleString('en-IN')}
          </p>
        </div>
        {restaurantLink && (
          <Link to={restaurantLink} className={cn('flex items-center gap-0.5 text-xs font-bold', linkTone)}>
            View <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
        {order.items?.map((i) => (
          <div key={i.id} className="flex items-center gap-3">
            {i.product_image ? (
              <img src={i.product_image} alt={i.product_name} className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span className="h-11 w-11 shrink-0 rounded-xl bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{i.product_name}</p>
              <SelectedOptionsList options={i.selected_options} className="mt-0.5" />
              <p className="text-xs text-neutral-500">
                {i.quantity} × <Price value={i.unit_price} size="sm" />
              </p>
            </div>
            <span className="text-sm font-bold text-neutral-900">
              <Price value={i.line_total} size="sm" />
            </span>
          </div>
        ))}
      </div>

      {hasInstructions && instructions && (
        <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Preparation notes</p>
          {instructions.selected.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {instructions.selected.map((s) => (
                <span key={s.key} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {s.emoji} {s.label}
                </span>
              ))}
            </div>
          )}
          {instructions.restaurant_note && (
            <p className="mt-1.5 text-xs text-neutral-600">“{instructions.restaurant_note}”</p>
          )}
          {instructions.send_cutlery === false && <p className="mt-1.5 text-xs text-neutral-500">Don't send cutlery</p>}
        </div>
      )}
    </Card>
  );
}

function AddressCard({ order, tone }: { order: Order; tone: 'brand' | 'food' | 'grocery' }) {
  const address = order.delivery_address_snapshot;
  const line = address
    ? [address.address_line_1, address.address_line_2, address.city, address.postal_code].filter(Boolean).join(', ')
    : 'Address on file';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 text-sm">
        <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'food' ? 'text-food-600' : tone === 'grocery' ? 'text-grocery-700' : 'text-brand-600')} />
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">
            {address?.contact_name ? `Delivery to ${address.contact_name}` : 'Delivery address'}
          </p>
          <p className="text-neutral-500">{line}</p>
          {order.customer_note && (
            <p className="mt-1.5 rounded-xl bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
              Delivery note: {order.customer_note}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function BillRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={cn('font-medium text-neutral-800', tone)}>
        <Price value={value} size="sm" />
      </span>
    </div>
  );
}

function BillCard({ order }: { order: Order }) {
  const paymentLabel = order.delivery_payment_collected_at
    ? 'Paid in cash to your delivery partner'
    : order.payment_method === 'cash_on_delivery'
      ? isOrderPaid(order.payment_status)
        ? 'Cash on delivery · paid online'
        : 'Cash on delivery'
      : `Paid via ${order.payment_method?.replace(/_/g, ' ') ?? '—'}`;

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-900">Bill details</h2>
        <Badge variant={isOrderPaid(order.payment_status) ? 'success' : 'neutral'}>
          {(order.payment_status ?? 'pending').replace(/_/g, ' ')}
        </Badge>
      </div>
      <div className="space-y-1.5 text-sm">
        <BillRow label="Subtotal" value={order.subtotal} />
        {parseFloat(order.discount_amount) > 0 && (
          <BillRow label="Discount" value={`-${order.discount_amount}`} tone="text-success" />
        )}
        {parseFloat(order.tax_amount) > 0 && <BillRow label="Taxes (included)" value={order.tax_amount} />}
        {parseFloat(order.delivery_fee) === 0 && order.timing_type === 'scheduled' ? (
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Delivery fee</span>
            <span className="font-semibold text-success">FREE</span>
          </div>
        ) : (
          <BillRow label="Delivery fee" value={order.delivery_fee} />
        )}
        {parseFloat(order.packaging_fee) > 0 && <BillRow label="Packaging charge" value={order.packaging_fee} />}
        {parseFloat(order.handling_fee) > 0 && <BillRow label="Handling fee" value={order.handling_fee} />}
        {parseFloat(order.delivery_gst_amount) > 0 && (
          <BillRow label={`Delivery GST (${Number(order.delivery_gst_percent)}%)`} value={order.delivery_gst_amount} />
        )}
        {parseFloat(order.tip_amount) > 0 && <BillRow label="Delivery partner tip" value={order.tip_amount} />}
        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-neutral-900">Total</span>
          <span className="text-base font-extrabold text-neutral-900">
            <Price value={order.total_amount} />
          </span>
        </div>
        <p className="text-xs text-neutral-500">{paymentLabel}</p>
        {order.refund_status && (
          <p className="text-xs font-semibold text-danger">
            Refund: {order.refund_status.replace(/_/g, ' ')}
            {order.refund_amount && parseFloat(order.refund_amount) > 0 ? ` · ${order.refund_amount}` : ''}
          </p>
        )}
      </div>
    </Card>
  );
}
