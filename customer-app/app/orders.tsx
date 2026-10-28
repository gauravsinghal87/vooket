import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AlertTriangle,
  Car,
  ChevronRight,
  Eye,
  MapPin,
  MoreVertical,
  RefreshCw,
  Search,
  ShoppingBasket,
  Star,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { Order, Ride } from '@/types/models';
import type { Paginated } from '@/types/api';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { ProductImage } from '@/components/ui/ProductImage';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState, Loader } from '@/components/ui/primitives';
import { toast } from '@/stores/toastStore';
import { useAppStore } from '@/stores/appStore';
import { formatCurrency } from '@/lib/utils';
import { activeService, colors, withAlpha } from '@/theme';

const MAX_VISIBLE_ITEMS = 3;

function badgeColor(status: string): string {
  const palette: Record<string, string> = {
    DELIVERED: '#0a9e74',
    TRIP_COMPLETED: '#0a9e74',
    PAID: '#0a9e74',
    COMPLETED: '#0a9e74',
    PLACED: '#0066ff',
    CONFIRMED: '#0066ff',
    PREPARING: '#b45309',
    READY: '#b45309',
    PICKED_UP: '#b45309',
    OUT_FOR_DELIVERY: '#b45309',
    ARRIVED: '#b45309',
    PARTNER_ASSIGNED: '#b45309',
    REQUESTING: '#b45309',
    SEARCHING_DRIVER: '#b45309',
    DRIVER_ASSIGNED: '#0066ff',
    DRIVER_ARRIVING: '#b45309',
    DRIVER_ARRIVED: '#b45309',
    TRIP_STARTED: '#0066ff',
    IN_PROGRESS: '#0066ff',
    PENDING: '#b45309',
    CANCELLED: '#dc2626',
    NO_DRIVER_FOUND: '#dc2626',
  };
  return palette[status] ?? colors.neutral[500];
}

function badgeBg(status: string): string {
  return withAlpha(badgeColor(status), 0.12);
}

function formatOrderPlaced(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase();
  return `${date}, ${time}`;
}

export default function OrdersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);
  const [rateOrder, setRateOrder] = useState<Order | null>(null);

  // Same resolution the bottom module switcher uses: the route when it names a
  // service, otherwise the persisted module the customer last picked. `/orders`
  // is cross-module, so the switcher's selection is what scopes this screen.
  const storedService = useAppStore((s) => s.service);
  const module = activeService(pathname) ?? storedService;
  const isRides = module === 'rides';

  // The module lives in the cache key, so switching modules starts a fresh
  // fetch and food, grocery and rides pages can never bleed into each other.
  // The backend filters by module inside the query (or reads the rides table),
  // so only the requested module's records are ever transferred.
  const history = useInfiniteQuery({
    queryKey: ['orders', 'history', module],
    queryFn: ({ pageParam }) => repositories.orders.getHistory(module, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
  });

  // Returning to this screen refreshes the current module's history. A cold
  // mount already fetches, so only already-cached data is invalidated here.
  useFocusEffect(
    useCallback(() => {
      if (queryClient.getQueryData(['orders', 'history', module])) {
        void queryClient.invalidateQueries({ queryKey: ['orders', 'history', module] });
      }
    }, [module, queryClient])
  );

  const reorder = useMutation({
    mutationFn: (id: number) => repositories.orders.reorder(id),
    onSuccess: (newOrder) => {
      toast('Items added to cart');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      router.push((newOrder.order_type === 'grocery' ? '/cart?type=grocery' : '/cart') as never);
    },
    onError: () => toast('Could not reorder', 'error'),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => repositories.orders.cancelOrder(id, 'Customer requested'),
    onSuccess: () => {
      toast('Order cancelled');
      setMenuOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast('Could not cancel order', 'error'),
  });

  // The active module's records only — narrowed from the pages the API
  // returned for that module, never filtered out of a combined list.
  const rows = useMemo(
    () => (history.data?.pages ?? []).flatMap((p) => (p as Paginated<Order | Ride>).data),
    [history.data]
  );
  const allOrders = useMemo(() => (isRides ? [] : (rows as Order[])), [isRides, rows]);
  const rideList = useMemo(() => (isRides ? (rows as Ride[]) : []), [isRides, rows]);

  const trimmed = query.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    if (!trimmed) return allOrders;
    return allOrders.filter((o) => {
      const restaurant = o.restaurant?.name ?? o.store?.name ?? '';
      const items = (o.items ?? []).map((i) => i.product_name).join(' ');
      return `${o.order_number} ${restaurant} ${items}`.toLowerCase().includes(trimmed);
    });
  }, [allOrders, trimmed]);

  const filteredRides = useMemo(() => {
    if (!trimmed) return rideList;
    return rideList.filter((r) => {
      const driver = r.driver?.name ?? r.driver?.user?.name ?? '';
      return `${r.ride_number} ${r.pickup_address ?? ''} ${r.destination_address ?? ''} ${driver}`
        .toLowerCase()
        .includes(trimmed);
    });
  }, [rideList, trimmed]);

  const loading = history.isLoading;
  const isError = history.isError;
  const refetch = () => void history.refetch();

  const hasOrders = filteredOrders.length > 0;
  const hasRides = filteredRides.length > 0;
  const hasResults = hasOrders || hasRides;
  const searching = trimmed.length > 0;

  function handleMenuAction(order: Order, action: 'view' | 'menu' | 'rate' | 'reorder' | 'cancel') {
    setMenuOrder(null);
    if (action === 'view') {
      router.push(`/order/${order.id}` as never);
    } else if (action === 'menu') {
      const outletId =
        order.order_type === 'food' ? order.restaurant?.id ?? order.restaurant_id : order.store?.id ?? order.store_id;
      if (outletId) router.push((order.order_type === 'food' ? `/restaurant/${outletId}` : `/store/${outletId}`) as never);
    } else if (action === 'rate') {
      setRateOrder(order);
    } else if (action === 'reorder') {
      reorder.mutate(order.id);
    } else if (action === 'cancel') {
      cancel.mutate(order.id);
    }
  }

  const loadingView = <Loader label="Loading…" />;

  const emptyTitle = searching
    ? isRides
      ? 'No matching rides found'
      : 'No matching orders found'
    : isRides
      ? 'No rides yet'
      : module === 'grocery'
        ? 'No Grocery orders yet'
        : 'No Food orders yet';
  const emptyDesc = searching
    ? isRides
      ? 'Try a different ride number, pickup or drop.'
      : 'Try a different restaurant, dish or order number.'
    : isRides
      ? 'Book a ride and it will show up here.'
      : module === 'grocery'
        ? 'Order groceries from a store near you to see them here.'
        : 'Start exploring restaurants and place your first order.';
  const emptyAction = searching ? undefined : isRides ? 'Book a ride' : module === 'grocery' ? 'Shop groceries' : 'Order food';
  const emptyActionRoute = isRides ? '/rides' : module === 'grocery' ? '/stores' : '/restaurants';

  return (
    <Screen header={<AppHeader variant="dark" title={isRides ? 'Your Rides' : 'Orders'} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.title}>{isRides ? 'Your Rides' : 'Your Orders'}</Text>
          <Text style={styles.subtitle}>
            {isRides ? 'Review your rides, fares and trip status.' : "Track, reorder and review everything you've ordered."}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Search size={18} color={colors.neutral[400]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={isRides ? 'Search by ride or location' : 'Search by restaurant or dish'}
              placeholderTextColor={colors.neutral[400]}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <XCircle size={16} color={colors.neutral[400]} />
              </Pressable>
            )}
          </View>
        </View>

        {loading && loadingView}

        {!loading && isError && (
          <EmptyState
            title="Couldn't load activity"
            message="Something went wrong while fetching your history."
            actionLabel="Retry"
            onAction={refetch}
          />
        )}

        {!loading && !isError && !hasResults && (
          <EmptyState
            title={emptyTitle}
            message={emptyDesc}
            actionLabel={emptyAction}
            onAction={emptyAction ? () => router.push(emptyActionRoute as never) : undefined}
          />
        )}

        {!loading && !isError && hasOrders && (
          <View style={styles.list}>
            {filteredOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => router.push(`/order/${o.id}` as never)}
                onOpenMenu={() => setMenuOrder(o)}
                onViewMenu={() => handleMenuAction(o, 'menu')}
                onRate={() => setRateOrder(o)}
                onReorder={() => reorder.mutate(o.id)}
                reordering={reorder.isPending && reorder.variables === o.id}
              />
            ))}
          </View>
        )}

        {!loading && !isError && hasRides && (
          <View style={styles.list}>
            {filteredRides.map((r) => (
              <RideCard key={r.id} ride={r} onClick={() => router.push(`/ride/${r.id}` as never)} />
            ))}
          </View>
        )}

        {!loading && !isError && hasResults && history.hasNextPage && (
          <Pressable
            onPress={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
            style={[styles.loadMore, history.isFetchingNextPage && { opacity: 0.6 }]}
          >
            {history.isFetchingNextPage && <ActivityIndicator size="small" color={colors.ink[900]} />}
            <Text style={styles.loadMoreText}>Load more</Text>
          </Pressable>
        )}
      </ScrollView>

      {menuOrder && (
        <BottomSheet title="Order options" visible onClose={() => setMenuOrder(null)}>
          <MenuAction icon={Eye} label="View order" onClick={() => handleMenuAction(menuOrder, 'view')} />
          {(() => {
            const outletId =
              menuOrder.order_type === 'food'
                ? menuOrder.restaurant?.id ?? menuOrder.restaurant_id
                : menuOrder.store?.id ?? menuOrder.store_id;
            return outletId ? (
              <MenuAction
                icon={MapPin}
                label={menuOrder.order_type === 'food' ? 'View menu' : 'View store'}
                onClick={() => handleMenuAction(menuOrder, 'menu')}
              />
            ) : null;
          })()}
          {menuOrder.status === 'DELIVERED' && (
            <MenuAction icon={Star} label="Rate order" onClick={() => handleMenuAction(menuOrder, 'rate')} />
          )}
          <MenuAction
            icon={RefreshCw}
            label={reorder.isPending && reorder.variables === menuOrder.id ? 'Adding to cart…' : 'Reorder'}
            disabled={reorder.isPending && reorder.variables === menuOrder.id}
            onClick={() => {
              setMenuOrder(null);
              reorder.mutate(menuOrder.id);
            }}
          />
          {(() => {
            const isCancelled = menuOrder.status === 'CANCELLED';
            const cancellable =
              !isCancelled &&
              !['DELIVERED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'PARTNER_ASSIGNED'].includes(menuOrder.status);
            return cancellable ? (
              <MenuAction
                icon={XCircle}
                label={cancel.isPending ? 'Cancelling…' : 'Cancel order'}
                danger
                disabled={cancel.isPending}
                onClick={() => handleMenuAction(menuOrder, 'cancel')}
              />
            ) : null;
          })()}
        </BottomSheet>
      )}

      {rateOrder && <RateSheet key={rateOrder.id} order={rateOrder} onClose={() => setRateOrder(null)} />}
    </Screen>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Star;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onClick}
      disabled={disabled}
      style={[styles.menuAction, danger && { backgroundColor: withAlpha(colors.danger, 0.06) }, disabled && { opacity: 0.5 }]}
    >
      <Icon size={20} color={danger ? colors.danger : colors.neutral[400]} />
      <Text style={[styles.menuActionText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function OrderCard({
  order,
  onClick,
  onOpenMenu,
  onViewMenu,
  onRate,
  onReorder,
  reordering,
}: {
  order: Order;
  onClick: () => void;
  onOpenMenu: () => void;
  onViewMenu: () => void;
  onRate: () => void;
  onReorder: () => void;
  reordering: boolean;
}) {
  const isFood = order.order_type === 'food';
  const restaurant = order.restaurant ?? null;
  const store = order.store ?? null;
  const outletName = restaurant?.name ?? store?.name ?? null;
  const outletAddress = restaurant?.address ?? store?.address ?? null;
  const outletRating = restaurant?.rating ?? store?.rating ?? null;
  const outletImg = restaurant
    ? restaurant.cover_image ?? restaurant.logo
    : store
      ? store.cover_image ?? store.logo
      : null;
  const outletId = isFood ? restaurant?.id ?? order.restaurant_id : store?.id ?? order.store_id;
  const items = order.items ?? [];
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = items.length - visibleItems.length;
  const paymentFailed = (order.payment_status ?? '').toLowerCase() === 'failed';
  const canRate = order.status === 'DELIVERED';
  const accent = isFood ? colors.food[600] : colors.grocery[600];
  const TypeIcon = isFood ? UtensilsCrossed : ShoppingBasket;

  const refundNote =
    order.refund_amount && order.refund_status
      ? `Refund of ₹${Number(order.refund_amount).toLocaleString('en-IN')} (${order.refund_status.replace(/_/g, ' ').toLowerCase()})`
      : null;

  return (
    <Pressable onPress={onClick} style={styles.card}>
      <View style={styles.cardTop}>
        {outletImg ? (
          <ProductImage src={outletImg} style={{ width: 56, height: 56 }} rounded />
        ) : (
          <View style={[styles.cardTypeIcon, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <TypeIcon size={24} color={accent} />
          </View>
        )}

        <View style={styles.cardTopRight}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {outletName ?? order.order_number}
            </Text>
            <Pressable style={styles.moreBtn} onPress={onOpenMenu} hitSlop={8}>
              <MoreVertical size={18} color={colors.neutral[400]} />
            </Pressable>
          </View>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {outletAddress ?? '—'}
            {outletRating ? ` · ★ ${Number(outletRating).toFixed(1)}` : ''}
          </Text>
          {outletId ? (
            <Pressable onPress={onViewMenu} hitSlop={6} style={styles.viewMenuRow}>
              <Text style={[styles.viewMenuText, { color: accent }]}>
                {isFood ? 'View menu' : 'View store'}
              </Text>
              <ChevronRight size={14} color={accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {paymentFailed && (
        <View style={styles.failedBanner}>
          <AlertTriangle size={16} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.failedTitle}>Payment failed</Text>
            <Text style={styles.failedDesc} numberOfLines={2}>
              {refundNote ?? "We couldn't complete your payment for this order."}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.items}>
        {visibleItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={[styles.bullet, { backgroundColor: colors.grocery[500] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemText} numberOfLines={1}>
                {item.quantity} × {item.product_name}
              </Text>
              {(item.selected_options ?? []).slice(0, 3).map((o) => (
                <Text key={o.option_id} style={styles.optionText} numberOfLines={1}>
                  {o.option_name}
                </Text>
              ))}
              {item.special_instructions ? (
                <Text style={styles.noteText} numberOfLines={1}>
                  Note: {item.special_instructions}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
        {hiddenCount > 0 && <Text style={styles.moreItems}>+ {hiddenCount} more items</Text>}
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFoot}>
        <View>
          <Text style={styles.placedText}>Order placed on {formatOrderPlaced(order.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: badgeBg(order.status) }]}>
            <Text style={[styles.badgeText, { color: badgeColor(order.status) }]}>
              {order.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>{formatCurrency(order.total_amount)}</Text>
          <ChevronRight size={16} color={colors.neutral[300]} />
        </View>
      </View>

      <View style={styles.cardActions}>
        {canRate ? (
          <Pressable onPress={onRate} style={styles.outlineBtn}>
            <Star size={16} color={isFood ? colors.food[600] : colors.neutral[400]} />
            <Text style={[styles.outlineBtnText, isFood && { color: colors.food[600] }]}>Rate</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onReorder} disabled={reordering} style={[styles.reorderBtn, { backgroundColor: isFood ? colors.food[600] : colors.grocery[600] }, reordering && { opacity: 0.6 }]}>
          <RefreshCw size={16} color="#fff" />
          <Text style={styles.reorderText}>{reordering ? 'Adding…' : 'Reorder'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function RideCard({ ride, onClick }: { ride: Ride; onClick: () => void }) {
  const driver = ride.driver?.name ?? ride.driver?.user?.name ?? null;
  const vehicle = ride.vehicle_type?.name ?? null;
  const fare = ride.final_fare ?? ride.estimated_fare;
  return (
    <Pressable onPress={onClick} style={styles.rideCard}>
      <View style={styles.rideCardTop}>
        <View style={[styles.cardTypeIcon, { backgroundColor: colors.brand[50] }]}>
          <Car size={24} color={colors.brand[700]} />
        </View>
        <View style={styles.cardTopRight}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {ride.ride_number}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {ride.pickup_address ?? 'Pickup'} → {ride.destination_address ?? 'Drop'}
          </Text>
          {(driver || vehicle) && (
            <Text style={styles.driverText} numberOfLines={1}>
              {[vehicle, driver && `Driver: ${driver}`].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <ChevronRight size={16} color={colors.neutral[300]} />
      </View>

      <View style={styles.rideDivider} />

      <View style={styles.rideCardFoot}>
        <View style={styles.rideFootLeft}>
          <Text style={styles.placedText} numberOfLines={1}>
            Ride on {formatOrderPlaced(ride.created_at)}
          </Text>
          <View style={[styles.badge, { backgroundColor: badgeBg(ride.status) }]}>
            <Text style={[styles.badgeText, { color: badgeColor(ride.status) }]}>
              {ride.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>{formatCurrency(fare)}</Text>
          <ChevronRight size={16} color={colors.neutral[300]} />
        </View>
      </View>
    </Pressable>
  );
}

function RateSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const rate = useMutation({
    mutationFn: () => repositories.orders.rateOrder(order.id, rating, comment || undefined),
    onSuccess: () => {
      toast('Thanks for your rating!');
      onClose();
    },
    onError: () => toast('Could not submit rating', 'error'),
  });

  return (
    <BottomSheet title="Rate your order" visible onClose={onClose}>
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
      <Pressable
        onPress={() => rate.mutate()}
        disabled={rate.isPending}
        style={[styles.rateSubmit, rate.isPending && { opacity: 0.6 }]}
      >
        <Text style={styles.rateSubmitText}>{rate.isPending ? 'Submitting…' : 'Submit'}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  list: {
    gap: 16,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 14,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  cardTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopRight: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  moreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  viewMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  viewMenuText: {
    fontSize: 12,
    fontWeight: '800',
  },
  failedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.danger, 0.08),
    padding: 10,
  },
  failedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },
  failedDesc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral[100],
    marginHorizontal: 14,
  },
  items: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[800],
  },
  optionText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  noteText: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  moreItems: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[500],
    paddingTop: 2,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  placedText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  totalText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  rideCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  rideDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral[100],
    marginHorizontal: 16,
  },
  rideCardFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  rideFootLeft: {
    flexShrink: 1,
    minWidth: 0,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 14,
    marginVertical: 14,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reorderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  driverText: {
    fontSize: 11,
    color: colors.neutral[400],
    marginTop: 1,
  },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
  },
  menuActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[800],
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
  },
  rateSubmit: {
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    paddingVertical: 14,
  },
  rateSubmitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
