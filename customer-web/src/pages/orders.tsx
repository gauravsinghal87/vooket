import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  ShoppingBasket,
  Car,
  ChevronRight,
  ReceiptText,
  Search,
  MoreVertical,
  Star,
  RefreshCw,
  Loader2,
  MapPin,
  Eye,
  XCircle,
  AlertTriangle,
  SearchX,
  type LucideIcon,
} from 'lucide-react';
import { repositories } from '@/repositories';
import type { Order, Ride } from '@/types/models';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SelectedOptionsList } from '@/components/product/selected-options';
import { toast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';

type Tab = 'all' | 'food' | 'grocery' | 'rides';
type StatusVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';

const statusVariant: Record<string, StatusVariant> = {
  DELIVERED: 'success',
  TRIP_COMPLETED: 'success',
  PAID: 'success',
  COMPLETED: 'success',
  PLACED: 'brand',
  CONFIRMED: 'brand',
  PREPARING: 'warning',
  READY: 'warning',
  PICKED_UP: 'warning',
  OUT_FOR_DELIVERY: 'warning',
  ARRIVED: 'warning',
  PARTNER_ASSIGNED: 'warning',
  REQUESTING: 'warning',
  SEARCHING_DRIVER: 'warning',
  DRIVER_ASSIGNED: 'brand',
  DRIVER_ARRIVING: 'warning',
  DRIVER_ARRIVED: 'warning',
  TRIP_STARTED: 'brand',
  IN_PROGRESS: 'brand',
  PENDING: 'warning',
  CANCELLED: 'danger',
  NO_DRIVER_FOUND: 'danger',
};

const MAX_VISIBLE_ITEMS = 3;

function formatOrderPlaced(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  let time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  time = time.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  return `${date}, ${time}`;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);
  const [rateOrder, setRateOrder] = useState<Order | null>(null);

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => repositories.orders.getOrders({}),
  });
  const { data: rides, isLoading: ridesLoading, isError: ridesError, refetch: refetchRides } = useQuery({
    queryKey: ['ride-history'],
    queryFn: () => repositories.rides.getRideHistory(),
  });

  const reorder = useMutation({
    mutationFn: (id: number) => repositories.orders.reorder(id),
    onSuccess: (newOrder) => {
      toast('Items added to cart');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      window.location.href = newOrder.order_type === 'grocery' ? '/cart?type=grocery' : '/cart';
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

  const allOrders = useMemo(() => ordersData?.data ?? [], [ordersData]);
  const rideList = useMemo(() => rides ?? [], [rides]);

  const trimmed = query.trim().toLowerCase();

  const tabbedOrders = useMemo(() => {
    if (tab === 'all') return allOrders;
    if (tab === 'rides') return [];
    return allOrders.filter((o) => o.order_type === tab);
  }, [allOrders, tab]);

  const filteredOrders = useMemo(() => {
    if (!trimmed) return tabbedOrders;
    return tabbedOrders.filter((o) => {
      const restaurant = o.restaurant?.name ?? o.store?.name ?? '';
      const items = (o.items ?? []).map((i) => i.product_name).join(' ');
      return `${o.order_number} ${restaurant} ${items}`.toLowerCase().includes(trimmed);
    });
  }, [tabbedOrders, trimmed]);

  const tabbedRides = useMemo(() => {
    if (tab !== 'rides' && tab !== 'all') return [];
    return tab === 'rides' ? rideList : rideList.slice(0, 3);
  }, [tab, rideList]);

  const filteredRides = useMemo(() => {
    if (!trimmed) return tabbedRides;
    return tabbedRides.filter((r) => {
      const driver = r.driver?.name ?? r.driver?.user?.name ?? '';
      return `${r.ride_number} ${r.pickup_address ?? ''} ${r.destination_address ?? ''} ${driver}`
        .toLowerCase()
        .includes(trimmed);
    });
  }, [tabbedRides, trimmed]);

  const loading = tab === 'rides' ? ridesLoading : ordersLoading;
  const error = tab === 'rides' ? ridesError : ordersError;
  const refetch = tab === 'rides' ? refetchRides : refetchOrders;

  const hasOrdersInTab = tab !== 'rides' && filteredOrders.length > 0;
  const hasRidesInTab = filteredRides.length > 0;
  const searching = trimmed.length > 0;

  function handleMenuAction(order: Order, action: 'view' | 'menu' | 'rate' | 'reorder' | 'cancel') {
    setMenuOrder(null);
    if (action === 'view') {
      navigate(`/order/${order.id}`);
    } else if (action === 'menu') {
      const outletId =
        order.order_type === 'food' ? order.restaurant?.id ?? order.restaurant_id : order.store?.id ?? order.store_id;
      if (outletId) navigate(order.order_type === 'food' ? `/restaurant/${outletId}` : `/store/${outletId}`);
    } else if (action === 'rate') {
      setRateOrder(order);
    } else if (action === 'reorder') {
      reorder.mutate(order.id);
    } else if (action === 'cancel') {
      cancel.mutate(order.id);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-neutral-900">
          <ReceiptText className="h-5 w-5 text-brand-600" /> Your Orders
        </h1>
        <p className="text-sm text-neutral-500">Track, reorder and review everything you've ordered.</p>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQuery('');
        }}
        variant="pill"
        getActiveClass={(v) => (v === 'food' ? 'bg-food-50 text-food-600' : undefined)}
        options={[
          { value: 'all', label: 'All' },
          { value: 'food', label: 'Food' },
          { value: 'grocery', label: 'Grocery' },
          { value: 'rides', label: 'Rides' },
        ]}
        className="max-w-sm"
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by restaurant or dish"
          aria-label="Search orders"
          className="h-11 w-full rounded-full border border-neutral-200 bg-white pl-10 pr-8 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Couldn't load activity" action={{ label: 'Retry', onClick: () => refetch() }} />
      )}

      {!loading && !error && !hasOrdersInTab && !hasRidesInTab && (
        <div className="space-y-4">
          {searching ? (
            <NoOrdersEmptyState />
          ) : tab === 'rides' ? (
            <EmptyState
              icon={Car}
              title="No rides yet"
              description="Book a ride and it will show up here."
              action={{ label: 'Book a ride', onClick: () => navigate('/rides') }}
            />
          ) : tab === 'food' ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No Food orders yet"
              description="Start exploring restaurants and place your first order."
              action={{ label: 'Order food', onClick: () => navigate('/restaurants') }}
            />
          ) : tab === 'grocery' ? (
            <EmptyState
              icon={ShoppingBasket}
              title="No Grocery orders yet"
              description="Order groceries from a store near you to see them here."
              action={{ label: 'Shop groceries', onClick: () => navigate('/stores') }}
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No orders yet"
              description="Your food orders, grocery orders and rides will appear here."
              action={{ label: 'Explore food', onClick: () => navigate('/restaurants') }}
            />
          )}
        </div>
      )}

      {!loading && !error && hasOrdersInTab && (
        <div className="space-y-4">
          {tab === 'all' && filteredRides.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-neutral-900">Ride history</h2>
              {filteredRides.map((r) => (
                <RideCard key={r.id} ride={r} onClick={() => navigate(`/ride/${r.id}`)} />
              ))}
            </>
          )}

          {filteredOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onClick={() => navigate(`/order/${o.id}`)}
              onOpenMenu={(e) => {
                e.stopPropagation();
                setMenuOrder(o);
              }}
              onViewMenu={(e) => {
                e.stopPropagation();
                handleMenuAction(o, 'menu');
              }}
              onRate={(e) => {
                e.stopPropagation();
                setRateOrder(o);
              }}
              onReorder={(e) => {
                e.stopPropagation();
                reorder.mutate(o.id);
              }}
              reordering={reorder.isPending && reorder.variables === o.id}
            />
          ))}
        </div>
      )}

      {!loading && !error && !hasOrdersInTab && hasRidesInTab && (
        <div className="space-y-4">
          {tab === 'all' && <h2 className="text-sm font-bold text-neutral-900">Ride history</h2>}
          {filteredRides.map((r) => (
            <RideCard key={r.id} ride={r} onClick={() => navigate(`/ride/${r.id}`)} />
          ))}
        </div>
      )}

      {menuOrder && (
        <BottomSheet title="Order options" open onOpenChange={(open) => !open && setMenuOrder(null)}>
          <div className="space-y-1">
            <MenuAction
              icon={Eye}
              label="View order"
              onClick={() => handleMenuAction(menuOrder, 'view')}
            />
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
              onClick={() => handleMenuAction(menuOrder, 'reorder')}
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
          </div>
        </BottomSheet>
      )}

      {rateOrder && <RateSheet key={rateOrder.id} order={rateOrder} onClose={() => setRateOrder(null)} />}
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors',
        danger ? 'text-danger hover:bg-danger/10' : 'text-neutral-800 hover:bg-neutral-100',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Icon className={cn('h-5 w-5', danger ? 'text-danger' : 'text-neutral-400')} />
      {label}
    </button>
  );
}

function NoOrdersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
        <SearchX className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900">No matching orders found</h3>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">Try a different restaurant, dish or order number.</p>
      </div>
    </div>
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
  onOpenMenu: (e: ReactMouseEvent) => void;
  onViewMenu: (e: ReactMouseEvent) => void;
  onRate: (e: ReactMouseEvent) => void;
  onReorder: (e: ReactMouseEvent) => void;
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
  const accent = isFood ? 'text-food-600' : 'text-success';
  const TypeIcon = isFood ? UtensilsCrossed : ShoppingBasket;

  const refundNote =
    order.refund_amount && order.refund_status
      ? `Refund of ${formatCurrency(order.refund_amount)} (${order.refund_status.replace(/_/g, ' ').toLowerCase()})`
      : null;

  return (
    <Card onClick={onClick} className="group overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        {outletImg ? (
          <Image
            src={outletImg}
            alt={outletName ?? ''}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              isFood ? 'bg-food-50 text-food-600' : 'bg-success/10 text-success'
            )}
          >
            <TypeIcon className="h-6 w-6" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[15px] font-bold text-neutral-900">
              {outletName ?? order.order_number}
            </p>
            <button
              aria-label="Order options"
              onClick={onOpenMenu}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>

          <p className="truncate text-xs text-neutral-500">
            {outletAddress ?? '—'}
            {outletRating ? (
              <span className="font-semibold text-success"> · ★ {Number(outletRating).toFixed(1)}</span>
            ) : null}
          </p>

          {outletId ? (
            <button
              onClick={onViewMenu}
              className={cn(
                'mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold',
                isFood ? 'text-food-600' : 'text-success'
              )}
            >
              {isFood ? 'View menu' : 'View store'} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <p className={cn('mt-0.5 text-xs font-bold opacity-70', accent)}>
              {isFood ? 'View menu' : 'View store'}
            </p>
          )}
        </div>
      </div>

      {paymentFailed && (
        <div className="mx-4 mb-1 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-danger">Payment failed</p>
            <p className="text-xs text-neutral-600">
              {refundNote ?? "We couldn't complete your payment for this order."}
            </p>
          </div>
        </div>
      )}

      <div className="mx-4 h-px bg-neutral-100" />

      <div className="space-y-1.5 px-4 py-3">
        {visibleItems.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800">
                {item.quantity} × {item.product_name}
              </p>
              <SelectedOptionsList inline options={item.selected_options} className="mt-px" />
              {item.special_instructions ? (
                <p className="truncate text-[11px] text-neutral-400">Note: {item.special_instructions}</p>
              ) : null}
            </div>
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="pt-0.5 text-xs font-semibold text-neutral-500">+ {hiddenCount} more items</p>
        )}
      </div>

      <div className="mx-4 h-px bg-neutral-100" />

      <div className="flex items-end justify-between gap-3 px-4 pb-4 pt-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">Order placed on {formatOrderPlaced(order.created_at)}</p>
          <div className="mt-1.5">
            <Badge variant={statusVariant[order.status] ?? 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center gap-0.5 text-sm font-extrabold text-neutral-900">
            <Price value={order.total_amount} size="sm" /> <ChevronRight className="h-4 w-4 text-neutral-300" />
          </p>
        </div>
      </div>

      <div className="mx-4 mb-4 flex items-center justify-between gap-2">
        {canRate ? (
          <Button variant="outline" size="sm" className={cn('gap-1.5', isFood && 'text-food-600')} onClick={onRate}>
            <Star className={cn('h-4 w-4', isFood ? 'text-food-600' : 'text-neutral-400')} />
            Rate
          </Button>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant={isFood ? 'accent' : 'default'}
          onClick={onReorder}
          disabled={reordering}
        >
          {reordering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Reorder
        </Button>
      </div>
    </Card>
  );
}

function RideCard({ ride, onClick }: { ride: Ride; onClick: () => void }) {
  const driver = ride.driver?.name ?? ride.driver?.user?.name ?? null;
  return (
    <Card onClick={onClick} className="group overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Car className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-neutral-900">{ride.ride_number}</p>
          <p className="truncate text-xs text-neutral-500">
            {ride.pickup_address ?? 'Pickup'} → {ride.destination_address ?? 'Drop'}
          </p>
          {driver && <p className="truncate text-[11px] text-neutral-400">Driver: {driver}</p>}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
      </div>

      <div className="mx-4 h-px bg-neutral-100" />

      <div className="flex items-end justify-between gap-3 px-4 pb-4 pt-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">Ride on {formatOrderPlaced(ride.created_at)}</p>
          <div className="mt-1.5">
            <Badge variant={statusVariant[ride.status] ?? 'neutral'}>{ride.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center gap-0.5 text-sm font-extrabold text-neutral-900">
            <Price value={ride.final_fare ?? ride.estimated_fare} size="sm" />
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </p>
        </div>
      </div>
    </Card>
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
    <BottomSheet title="Rate your order" open onOpenChange={(open) => !open && onClose()}>
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
  );
}