import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CreditCard,
  HandCoins,
  HelpCircle,
  KeyRound,
  Loader,
  MapPin,
  RefreshCw,
  Star,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import { useRealtimeOrder, useRealtimeTracking } from '@/shared/utils/realtime';
import { OrderTrackingMap } from '@/features/orders/components/OrderTrackingMap';
import { OrderTrackingPromo } from '@/features/orders/components/OrderTrackingPromo';
import { TrackingCard } from '@/features/orders/components/TrackingCard';
import { TrackingHeader } from '@/features/orders/components/TrackingHeader';
import { DeliveryPartnerPanel } from '@/features/orders/components/DeliveryPartnerPanel';
import { createUsableCheckout, completeOrderPayment } from '@/shared/utils/payments';
import { formatEta, isTrackingActive } from '@/shared/utils/orderTracking';
import { isTerminalStatus, orderStatusHeading } from '@/shared/utils/orderStatus';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { SupportRequestSheet } from '@/features/support/components/SupportRequestSheet';
import { Loader as Spinner } from '@/shared/components/ui/primitives';
import { toast } from '@/shared/stores/toastStore';
import { formatCurrency, isOrderPaid, isOrderPastVendorAcceptance } from '@/shared/utils/utils';
import { resolveOrderSupportModule } from '@/shared/utils/support';
import { colors, withAlpha } from '@/shared/theme';
import type { Order, PreparationInstructionsPayload } from '@/shared/types/models';

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();
  const [rateOpen, setRateOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const initialQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repositories.orders.getOrder(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
    retry: false,
  });
  const { data: liveOrder } = useRealtimeOrder(Number.isFinite(orderId) ? orderId : undefined);
  const { data: tracking } = useRealtimeTracking(Number.isFinite(orderId) ? orderId : undefined);

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const mapsApiKey =
    appConfig?.maps?.enabled === true && appConfig?.maps?.public_key ? appConfig.maps.public_key : null;

  const order = liveOrder ?? initialQuery.data;

  // The support form's module comes from the order's own `order_type` — never
  // from the merchant name, the screen title or the order id. `null` means the
  // order does not identify a module, and the sheet says so instead of
  // silently defaulting to Food.
  const supportModule = resolveOrderSupportModule(order);

  // The order's service decides which Admin-managed promo carousel renders
  // (Food vs Grocery). Keyed by service so React Query dedupes and caches each
  // service's `order_tracking` placement, and a Food promo can never bleed into
  // a Grocery order.
  const orderService: 'food' | 'grocery' = order?.order_type === 'grocery' ? 'grocery' : 'food';
  const { data: trackingBanners, isLoading: bannersLoading } = useQuery({
    queryKey: ['banners', 'order_tracking', orderService],
    queryFn: () => repositories.banners.getByPlacement(orderService, 'order_tracking'),
    enabled: Boolean(order),
    staleTime: 5 * 60 * 1000,
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
      router.push((newOrder.order_type === 'grocery' ? '/cart?type=grocery' : '/cart') as never);
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

  if (!order) {
    if (initialQuery.isError) {
      return (
        <Screen header={<AppHeader variant="dark" title="Order" />}>
          <View style={styles.notFound}>
            <XCircle size={40} color={colors.danger} />
            <Text style={styles.notFoundTitle}>Order not found</Text>
            <Text style={styles.notFoundDesc}>This order was removed or is no longer available.</Text>
            <Pressable style={styles.outlineBtn} onPress={() => router.push('/orders' as never)}>
              <Text style={styles.outlineBtnText}>Back to orders</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => void initialQuery.refetch()}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        </Screen>
      );
    }
    return (
      <Screen header={<AppHeader variant="dark" title="Order" />}>
        <Spinner label="Loading order…" />
      </Screen>
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const tone: 'brand' | 'food' | 'grocery' = order.order_type === 'grocery' ? 'grocery' : 'food';
  const pastVendorAcceptance = isOrderPastVendorAcceptance(order.status);
  // Only expose Cancel/Reorder once we have a fresh status for this mount, so a
  // cached (stale) status can never briefly show actions the vendor acceptance
  // has since prohibited. `useRealtimeOrder` always fetches on mount.
  const statusFresh = Boolean(liveOrder) || initialQuery.isFetchedAfterMount;
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

  // Admin-managed order-tracking promos: a strict placement match drops the
  // shared all/null banners the endpoint returns, so only order-tracking promos
  // ever render in the carousel.
  const promoBanners = (trackingBanners ?? []).filter((b) => b.placement === 'order_tracking');
  const showBanner = promoBanners.length > 0 || bannersLoading;
  // The expanded-map layout is only reachable when the tracking section actually
  // has a live map (active tracking + a public Maps key).
  const mapAvailable = Boolean(showTracking && mapsApiKey);
  // Single source of truth: the promo + compact card and the expanded header +
  // map are two states of one value, so they always switch together.
  const showExpandedMap = mapExpanded && mapAvailable;
  // Expanded map height: ~48% of the viewport, clamped to 320–440 (native port
  // of the web `clamp(320px, 48vh, 440px)`).
  const expandedMapHeight = Math.round(Math.min(Math.max(windowHeight * 0.48, 320), 440));

  const openSupport = () => {
    setSupportOpen(true);
  };

  return (
    <Screen
      header={<AppHeader variant="dark" title="Order" tone={tone} />}
      scrollProps={{ showsVerticalScrollIndicator: false }}
    >
      {showExpandedMap ? (
        /* Expanded-map mode — a distinct layout state. The promo carousel and
           the compact tracking card are unmounted, and a single compact themed
           header + full map takes their place. The map is ~48% of the viewport
           height so the order details below stay reachable by scrolling. Header
           and map share one continuous themed surface — Food red or Grocery gold. */
        <View style={styles.expandedWrap}>
          <TrackingHeader
            orderType={order.order_type}
            restaurantName={restaurantName}
            heading={heading}
            etaLabel={etaLabel}
            cancelled={isCancelled}
            refreshing={initialQuery.isFetching}
            onRefresh={() => void initialQuery.refetch()}
            onCollapse={() => setMapExpanded(false)}
          />
          <View style={[styles.expandedMap, { height: expandedMapHeight }]}>
            <OrderTrackingMap tracking={tracking!} mapsApiKey={mapsApiKey} tone={tone} style={StyleSheet.absoluteFill} />
          </View>
        </View>
      ) : (
        <>
          {/* A. Admin-managed promo carousel — full-bleed, directly under the app
              header. Placement is resolved for the order's service, so Food
              promos never bleed into Grocery and vice versa. */}
          {showBanner && <OrderTrackingPromo banners={promoBanners} loading={bannersLoading} />}

          {/* B. Compact Zomato-style tracking card, pulled up to overlap the
              banner's bottom edge. Its mini-map is the only Maps instance in this
              state, so the two layouts never double-mount the map; the card
              simply drops the map column when none is available. */}
          <View style={[styles.cardWrap, showBanner && styles.cardOverlap]}>
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
                    mapsApiKey={mapsApiKey}
                    tone={tone}
                    style={StyleSheet.absoluteFill}
                    interactive={false}
                  />
                ) : undefined
              }
              onExpand={mapAvailable ? () => setMapExpanded(true) : undefined}
            />
          </View>
        </>
      )}

      {/* C. Delivery partner panel directly below the tracking card (only while dispatching). */}
      {partnerCardVisible && <DeliveryPartnerPanel tracking={tracking!} tone={tone} />}

      {/* D. Order details. */}
      <View style={styles.content}>
        {/* Payment card sits immediately before the Delivery OTP card. */}
        {!isCancelled &&
          (order.delivery_payment_collected_at ? (
            <PaymentNotice kind="cash" order={order} />
          ) : order.payment_method === 'online' || order.payment_method === 'cash_on_delivery' ? (
            isOrderPaid(order.payment_status) ? (
              <PaymentNotice kind="received" order={order} />
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
          onPressLink={restaurantLink ? () => router.push(restaurantLink as never) : undefined}
        />

        {order.order_type === 'grocery' && <DeliveryScheduleCard order={order} />}

        <AddressCard order={order} tone={tone} />

        <BillCard order={order} />

        <View style={styles.actions}>
          {order.help_available !== false && (
            <Pressable style={styles.helpBtn} onPress={openSupport}>
              <HelpCircle size={16} color={colors.ink[800]} />
              <Text style={styles.helpBtnText}>Get help</Text>
            </Pressable>
          )}
          {cancellable && (
            <Pressable style={styles.cancelBtn} onPress={() => setConfirmCancelOpen(true)}>
              <XCircle size={16} color={colors.danger} />
              <Text style={styles.cancelBtnText}>Cancel order</Text>
            </Pressable>
          )}
          {canReorder && (
            <Pressable style={[styles.reorderBtn, reorder.isPending && { opacity: 0.6 }]} onPress={() => reorder.mutate()} disabled={reorder.isPending}>
              {reorder.isPending ? <Loader size={16} color="#fff" /> : <RefreshCw size={16} color="#fff" />}
              <Text style={styles.reorderBtnText}>{reorder.isPending ? 'Adding…' : 'Reorder'}</Text>
            </Pressable>
          )}
          {!isCancelled && order.status === 'DELIVERED' && (
            <Pressable
              style={styles.rateBtn}
              onPress={() => setRateOpen(true)}
            >
              <Star size={16} color={tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[700] : colors.brand[700]} />
              <Text style={[styles.rateBtnText, { color: tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[700] : colors.brand[700] }]}>
                Rate order
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <BottomSheet title="Cancel this order?" visible={confirmCancelOpen} onClose={() => setConfirmCancelOpen(false)}>
        <Text style={styles.sheetText}>
          This will cancel your order and start any eligible refund. This can’t be undone.
        </Text>
        <View style={styles.sheetRow}>
          <Pressable style={[styles.sheetGhost, { flex: 1 }]} onPress={() => setConfirmCancelOpen(false)}>
            <Text style={styles.sheetGhostText}>Keep order</Text>
          </Pressable>
          <Pressable
            style={[styles.sheetDanger, { flex: 1 }, cancel.isPending && { opacity: 0.6 }]}
            onPress={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? <Loader size={16} color="#fff" /> : null}
            <Text style={styles.sheetDangerText}>Cancel order</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <SupportRequestSheet
        title="Get help with this order"
        subtitle={
          order
            ? `Order ${order.order_number} · ${restaurantName} · ${formatCurrency(order.total_amount)}`
            : undefined
        }
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        module={supportModule}
        referenceType="order"
        referenceId={order?.id ?? 0}
        ticketType="order"
        subjectFallback={order ? `Order ${order.order_number} support request` : 'Order support request'}
        totalAmount={order ? Number(order.total_amount) : null}
        onSubmitted={() => {
          toast('Request submitted', 'success');
          void initialQuery.refetch();
        }}
      />

      <BottomSheet title="Rate your order" visible={rateOpen} onClose={() => setRateOpen(false)}>
        <View style={styles.rateStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
              <Star size={36} color={n <= rating ? '#f59e0b' : colors.neutral[200]} fill={n <= rating ? '#f59e0b' : 'transparent'} />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment (optional)"
          placeholderTextColor={colors.neutral[400]}
          multiline
          style={styles.rateInput}
        />
        <Pressable style={[styles.submitBtn, rate.isPending && { opacity: 0.6 }]} onPress={() => rate.mutate()} disabled={rate.isPending}>
          <Text style={styles.submitText}>{rate.isPending ? 'Submitting…' : 'Submit'}</Text>
        </Pressable>
      </BottomSheet>
    </Screen>
  );
}

function RestaurantSummary({
  order,
  tone,
  restaurantName,
  restaurantLogo,
  onPressLink,
}: {
  order: Order;
  tone: 'brand' | 'food' | 'grocery';
  restaurantName: string;
  restaurantLogo: string | null;
  onPressLink?: () => void;
}) {
  const linkColor =
    tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[700] : colors.brand[600];
  const { data: prep } = useQuery<PreparationInstructionsPayload>({
    queryKey: ['order', order.id, 'preparation'],
    queryFn: () => repositories.orders.getPreparationInstructions(order.id),
    enabled: order.order_type === 'food',
    retry: false,
  });

  const instructions = prep?.instructions;
  const hasInstructions =
    !!instructions &&
    (instructions.selected.length > 0 || !!instructions.restaurant_note || instructions.send_cutlery === false);

  return (
    <View style={styles.card}>
      <View style={styles.restaurantRow}>
        <View style={styles.restaurantLogo}>
          {restaurantLogo ? (
            <ProductImage src={restaurantLogo} style={styles.restaurantLogoImg} />
          ) : (
            <Truck size={20} color={colors.neutral[400]} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurantName}
          </Text>
          <Text style={styles.restaurantMeta} numberOfLines={1}>
            Order {order.order_number} · {new Date(order.created_at).toLocaleString('en-IN')}
          </Text>
        </View>
        {onPressLink && (
          <Pressable style={styles.viewLink} onPress={onPressLink} hitSlop={6}>
            <Text style={[styles.viewLinkText, { color: linkColor }]}>View</Text>
            <ChevronRight size={14} color={linkColor} />
          </Pressable>
        )}
      </View>

      <View style={styles.items}>
        {order.items?.map((i) => (
          <View key={i.id} style={styles.itemRow2}>
            <ProductImage src={i.product_image} style={{ width: 52, height: 52 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {i.product_name}
              </Text>
              {(i.selected_options ?? []).map((o) => (
                <Text key={o.option_id} style={styles.optionText} numberOfLines={1}>
                  {o.option_name}
                </Text>
              ))}
              <Text style={styles.itemQty}>
                {i.quantity} × {formatCurrency(i.unit_price)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatCurrency(i.line_total)}</Text>
          </View>
        ))}
      </View>

      {hasInstructions && instructions && (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>Preparation notes</Text>
          {instructions.selected.length > 0 && (
            <View style={styles.noteChips}>
              {instructions.selected.map((s) => (
                <View key={s.key} style={styles.noteChip}>
                  <Text style={styles.noteChipText}>
                    {s.emoji} {s.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {instructions.restaurant_note && <Text style={styles.noteText}>“{instructions.restaurant_note}”</Text>}
          {instructions.send_cutlery === false && <Text style={styles.noteMuted}>Don’t send cutlery</Text>}
        </View>
      )}
    </View>
  );
}

function AddressCard({ order, tone }: { order: Order; tone: 'brand' | 'food' | 'grocery' }) {
  const accent = tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[700] : colors.brand[600];
  const address = order.delivery_address_snapshot;
  const line = address
    ? [address.address_line_1, address.address_line_2, address.city, address.postal_code].filter(Boolean).join(', ')
    : 'Address on file';

  return (
    <View style={styles.card}>
      <View style={styles.addressRow}>
        <MapPin size={16} color={accent} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.addressTitle}>
            {address?.contact_name ? `Delivery to ${address.contact_name}` : 'Delivery address'}
          </Text>
          <Text style={styles.addressText}>{line}</Text>
          {order.customer_note ? (
            <Text style={styles.deliveryNote}>Delivery note: {order.customer_note}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function BillRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text style={styles.billLabel}>{label}</Text>
      <Text style={[styles.billValue, positive && { color: colors.grocery[600] }]}>
        {positive ? `-${formatCurrency(value)}` : formatCurrency(value)}
      </Text>
    </View>
  );
}

function BillCard({ order }: { order: Order }) {
  const paid = isOrderPaid(order.payment_status);
  const payNote = order.delivery_payment_collected_at
    ? 'Paid in cash to your delivery partner'
    : order.payment_method === 'cash_on_delivery'
      ? paid
        ? 'Cash on delivery · paid online'
        : 'Cash on delivery'
      : `Paid via ${order.payment_method?.replace(/_/g, ' ') ?? '—'}`;

  return (
    <View style={styles.card}>
      <View style={styles.billHead}>
        <Text style={styles.cardTitle}>Bill details</Text>
        <View style={[styles.badge, { backgroundColor: withAlpha(paid ? colors.success : colors.neutral[400], 0.12) }]}>
          <Text style={[styles.badgeText, { color: paid ? colors.success : colors.neutral[500] }]}>
            {(order.payment_status ?? 'pending').replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
      <View style={styles.bill}>
        <BillRow label="Subtotal" value={order.subtotal} />
        {parseFloat(order.discount_amount) > 0 && <BillRow label="Discount" value={order.discount_amount} positive />}
        {parseFloat(order.tax_amount) > 0 && <BillRow label="Taxes" value={order.tax_amount} />}
        {parseFloat(order.delivery_fee) === 0 && order.timing_type === 'scheduled' ? (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery fee</Text>
            <Text style={styles.billFree}>FREE</Text>
          </View>
        ) : (
          <BillRow label="Delivery fee" value={order.delivery_fee} />
        )}
        {parseFloat(order.packaging_fee) > 0 && <BillRow label="Packaging charge" value={order.packaging_fee} />}
        {parseFloat(order.handling_fee) > 0 && <BillRow label="Handling fee" value={order.handling_fee} />}
        {parseFloat(order.delivery_gst_amount) > 0 && (
          <BillRow label={`Delivery GST (${Number(order.delivery_gst_percent)}%)`} value={order.delivery_gst_amount} />
        )}
        {parseFloat(order.tip_amount) > 0 && <BillRow label="Delivery partner tip" value={order.tip_amount} />}
        <View style={styles.billTotalRow}>
          <Text style={styles.billTotalLabel}>Total</Text>
          <Text style={styles.billTotalValue}>{formatCurrency(order.total_amount)}</Text>
        </View>
        <Text style={styles.payNote}>{payNote}</Text>
        {order.refund_status ? (
          <Text style={styles.refundText}>
            Refund: {order.refund_status.replace(/_/g, ' ')}
            {order.refund_amount && parseFloat(order.refund_amount) > 0 ? ` · ${formatCurrency(order.refund_amount)}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DeliveryOtpCard({ orderId, active, tone }: { orderId: number; active: boolean; tone: 'brand' | 'food' | 'grocery' }) {
  const accentColor = tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[700] : colors.brand[700];
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['order', orderId, 'delivery-otp'],
    queryFn: () => repositories.orders.getDeliveryOtp(orderId),
    enabled: active,
    retry: false,
    refetchInterval: active ? 15_000 : false,
  });

  if (!active) return null;

  if (isError && error instanceof Error) {
    const waitingForPartner = error.message.includes('Ask your delivery partner');
    return (
      <View style={styles.card}>
        <View style={[styles.otpNotice, { backgroundColor: waitingForPartner ? colors.ink[50] : withAlpha('#f59e0b', 0.12) }]}>
          <View style={styles.otpNoticeHead}>
            <KeyRound size={16} color={waitingForPartner ? colors.neutral[500] : '#b45309'} />
            <Text style={[styles.otpNoticeTitle, { color: waitingForPartner ? colors.neutral[500] : '#b45309' }]}>
              {waitingForPartner ? 'Delivery OTP not ready yet' : 'Delivery code unavailable'}
            </Text>
          </View>
          <Text style={styles.otpNoticeDesc}>
            {waitingForPartner ? 'Your delivery partner will request your code when they arrive.' : error.message}
          </Text>
          {!waitingForPartner && (
            <Pressable style={styles.otpRetry} onPress={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader size={14} color={colors.neutral[500]} /> : <RefreshCw size={14} color={colors.neutral[500]} />}
              <Text style={styles.otpRetryText}>Try again</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (isPending || !data) {
    return (
      <View style={styles.card}>
        <View style={[styles.otpSkeleton, { backgroundColor: colors.neutral[100] }]} />
        <View style={[styles.otpSkeleton, { height: 36, width: 130, marginTop: 12 }]} />
      </View>
    );
  }

  const expiresAt = new Date(data.expires_at);
  const expired = Number.isNaN(expiresAt.getTime()) ? false : expiresAt.getTime() <= Date.now();

  return (
    <View style={[styles.card, { padding: 0 }]}>
      <View style={[styles.otpHead, { backgroundColor: withAlpha(accentColor, 0.08) }]}>
        <KeyRound size={16} color={accentColor} />
        <Text style={styles.otpTitle}>Delivery verification</Text>
        <Text style={styles.otpFor}>for your order</Text>
      </View>
      <View style={styles.otpBody}>
        <Text style={styles.otpDesc}>Your delivery partner needs this 6-digit code to complete delivery.</Text>
        <View style={styles.otpRow}>
          <View>
            <Text style={styles.otpLabel}>Delivery OTP</Text>
            <Text style={[styles.otpCode, { color: accentColor }]}>{data.otp}</Text>
            <Text style={styles.otpValid}>
              {expired ? 'This code has expired — ask your partner to request a new one.' : `Valid until ${expiresAt.toLocaleTimeString('en-IN')}`}
            </Text>
          </View>
          <Pressable style={styles.otpRefresh} onPress={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader size={16} color={colors.ink[800]} /> : <RefreshCw size={16} color={colors.ink[800]} />}
          </Pressable>
        </View>
        <View style={styles.otpTip}>
          <Text style={styles.otpTipText}>
            Share this code with your delivery partner to confirm your delivery. Don’t share it with anyone else.
          </Text>
        </View>
      </View>
    </View>
  );
}

function PayNowCard({ order, tone }: { order: Order; tone: 'brand' | 'food' | 'grocery' }) {
  const queryClient = useQueryClient();
  // Each service uses its module's primary: Food red (#d42021) and Grocery gold.
  // `brand` remains the neutral fallback. No new shade is introduced.
  const isFood = tone === 'food';
  const isGrocery = tone === 'grocery';
  const buttonColor = isFood ? colors.food[600] : isGrocery ? colors.grocery[500] : colors.ink[900];
  const buttonPressed = isFood ? colors.food[700] : isGrocery ? colors.grocery[600] : colors.ink[800];
  const buttonText = isGrocery ? colors.ink[900] : '#fff';
  const iconColor = isFood ? colors.food[700] : isGrocery ? colors.grocery[800] : colors.brand[700];
  const pay = useMutation({
    mutationFn: async () => {
      const checkout = await createUsableCheckout(
        (idempotencyKey) =>
          repositories.payments.initiate({
            payable_type: 'order',
            payable_id: order.id,
            payment_method: 'card',
            idempotency_key: idempotencyKey,
          }),
        `order:pay:${order.id}`
      );
      return completeOrderPayment(checkout);
    },
    onSuccess: (result) => {
      if (result.status === 'paid') {
        toast('Payment successful!');
        queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      } else {
        toast('Payment cancelled. You can pay again.', 'error');
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error'),
  });

  return (
    <View style={styles.card}>
      <View style={styles.payHead}>
        <View style={[styles.payIcon, { backgroundColor: withAlpha(iconColor, 0.1) }]}>
          <CreditCard size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.payTitle}>Payment pending</Text>
          <Text style={styles.payDesc}>
            Order total {formatCurrency(order.total_amount)} ·{' '}
            {order.payment_method === 'cash_on_delivery' ? 'Pay online now to skip cash at the door.' : 'Complete payment to confirm your order.'}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.payNowBtn,
          { backgroundColor: buttonColor },
          pressed && !pay.isPending && { backgroundColor: buttonPressed },
          pay.isPending && { opacity: 0.6 },
        ]}
        onPress={() => pay.mutate()}
        disabled={pay.isPending}
      >
        {pay.isPending ? <Loader size={16} color={buttonText} /> : <CreditCard size={16} color={buttonText} />}
        <Text style={[styles.payNowText, { color: buttonText }]}>{pay.isPending ? 'Processing…' : 'Pay now'}</Text>
      </Pressable>
    </View>
  );
}

function PaymentNotice({ kind, order }: { kind: 'cash' | 'received'; order: Order }) {
  const Icon = kind === 'cash' ? HandCoins : BadgeCheck;
  const title = kind === 'cash' ? 'Paid in cash' : 'Payment received';
  // Green success styling is only shown when the backend confirms the payment
  // succeeded (paid status, or cash explicitly collected at the door).
  const paid = isOrderPaid(order.payment_status) || Boolean(order.delivery_payment_collected_at);
  const desc =
    kind === 'cash'
      ? `Your delivery partner collected ${formatCurrency(order.total_amount)} at your door.`
      : `${(order.payment_status ?? 'Paid').replace(/_/g, ' ')} · ${formatCurrency(order.total_amount)} via online payment`;
  return (
    <View style={[styles.card, paid && styles.paidCard]}>
      <View style={styles.payHead}>
        <View style={[styles.receivedIcon, paid && styles.paidIcon]}>
          <Icon size={20} color={paid ? colors.success : colors.grocery[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.payDesc}>{desc}</Text>
        </View>
      </View>
    </View>
  );
}

function DeliveryScheduleCard({ order }: { order: Order }) {
  const schedule = order.meta?.delivery_schedule as
    | { delivery_mode?: string; slot_date?: string; start_time?: string; end_time?: string; label?: string }
    | undefined;

  if (!schedule || schedule.delivery_mode !== 'scheduled' || !schedule.slot_date) {
    return (
      <View style={styles.scheduleCard}>
        <Zap size={16} color={colors.grocery[700]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.scheduleTitle}>Delivering as soon as possible</Text>
          <Text style={styles.scheduleDesc}>We’ll notify you when it’s on the way.</Text>
        </View>
      </View>
    );
  }

  const when = new Date(`${schedule.slot_date}T${(schedule.start_time ?? '').slice(0, 5)}`).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.scheduleCard}>
      <CalendarClock size={16} color={colors.grocery[700]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.scheduleTitle}>{when}</Text>
        <Text style={styles.scheduleDesc}>
          {schedule.label ?? 'Scheduled delivery'} · {order.status === 'SCHEDULED' ? 'Scheduled' : 'Confirmed'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  expandedWrap: {
    width: '100%',
    backgroundColor: colors.ink[950],
  },
  expandedMap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.ink[950],
  },
  cardWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    zIndex: 10,
  },
  cardOverlap: {
    marginTop: -20,
  },
  notFound: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  notFoundDesc: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  restaurantLogoImg: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  restaurantMeta: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  viewLinkText: {
    fontSize: 12,
    fontWeight: '800',
  },
  items: {
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
    paddingTop: 12,
  },
  itemRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  optionText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  itemQty: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  notes: {
    borderRadius: 16,
    backgroundColor: colors.ink[50],
    padding: 12,
    gap: 6,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  noteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noteChip: {
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  noteChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink[800],
  },
  noteText: {
    fontSize: 12,
    color: colors.ink[800],
  },
  noteMuted: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  addressText: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 1,
  },
  deliveryNote: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.ink[800],
    overflow: 'hidden',
  },
  billHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bill: {
    gap: 6,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink[800],
  },
  billFree: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.grocery[600],
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  billTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  payNote: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  refundText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 2,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  helpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.3),
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  reorderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rateBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetText: {
    fontSize: 14,
    color: colors.ink[700],
  },
  sheetRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sheetGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 13,
  },
  sheetGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[800],
  },
  sheetDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.danger,
    paddingVertical: 13,
  },
  sheetDangerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  rateStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  rateInput: {
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    padding: 12,
    fontSize: 14,
    color: colors.ink[900],
    textAlignVertical: 'top',
    marginTop: 12,
  },
  submitBtn: {
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  otpNotice: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  otpNoticeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  otpNoticeDesc: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  otpRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  otpRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  otpSkeleton: {
    height: 16,
    width: 160,
    borderRadius: 8,
  },
  otpHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[100],
  },
  otpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  otpFor: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.neutral[500],
  },
  otpBody: {
    padding: 16,
    gap: 12,
  },
  otpDesc: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.neutral[400],
  },
  otpCode: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 2,
  },
  otpValid: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 6,
  },
  otpRefresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpTip: {
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    padding: 12,
  },
  otpTipText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral[500],
  },
  payHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  payIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivedIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.grocery[600], 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidCard: {
    borderColor: withAlpha(colors.success, 0.3),
  },
  paidIcon: {
    backgroundColor: withAlpha(colors.success, 0.1),
  },
  payTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  payDesc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 13,
  },
  payNowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  outlineBtn: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 14,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  scheduleDesc: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 1,
  },
  sheetPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 13,
  },
  sheetPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
