import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  X,
  MapPin,
  ChevronRight,
  CalendarClock,
  Truck,
  Star,
  RefreshCw,
  Wifi,
  StickyNote,
} from 'lucide-react';
import { ordersApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatDateTime, timeFromNow } from '@/lib/utils';
import type {
  PreparationInstructions,
  SelectedPreparationInstruction,
  VendorDeliveryPartnerCandidate,
  VendorDispatchLog,
  VendorOrder,
  VendorOrderItem,
  VendorOrderItemOption,
} from '@/typings/models';

const optionPrice = (o: VendorOrderItemOption): number => {
  const raw = o.option_price != null && o.option_price !== '' ? o.option_price : o.price;
  return Number(raw) || 0;
};

/**
 * List queries the vendor orders page renders. They share the `vendor-orders`
 * key prefix but differ by tab/page/search, so a status change has to be
 * written into every cached page for the row to update wherever it's shown.
 */
type VendorOrdersListCache = { data: VendorOrder[]; current_page?: number; last_page?: number; total?: number };

function patchOrderInListCaches(
  qc: ReturnType<typeof useQueryClient>,
  orderId: number,
  patch: Partial<VendorOrder>,
) {
  qc.setQueriesData<VendorOrdersListCache>({ queryKey: ['vendor-orders'] }, (old) => {
    if (!old || !Array.isArray(old.data)) return old;
    let changed = false;
    const data = old.data.map((order) => {
      if (order.id !== orderId) return order;
      changed = true;
      return { ...order, ...patch };
    });
    return changed ? { ...old, data } : old;
  });
}

/**
 * Order line prices come from the order-time snapshot. Decimals are kept only
 * when the snapshot carries them, so a round ₹299 stays ₹299 while a variable
 * item like ₹109.43 keeps its paise.
 */
const formatItemPrice = (value: number | string): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '₹0';
  const decimals = Number.isInteger(num) ? 0 : 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/** How many item lines a row shows before collapsing into "+N more". */
const MAX_VISIBLE_ITEM_LINES = 3;

/**
 * Compact per-item option summary: options are grouped by their group name so a
 * variable product reads as "Add-ons: Adrak, Elaichi" and "Size: Large" without
 * widening the row. Purely decorative summary — the drawer shows full detail.
 */
function OptionSummaryLines({ item }: { item: VendorOrderItem }) {
  const options = item.selected_options ?? [];
  if (options.length === 0) return null;

  const byGroup = new Map<string, string[]>();
  for (const option of options) {
    const price = optionPrice(option);
    const suffix = price > 0 ? ` +${formatItemPrice(price)}` : '';
    const list = byGroup.get(option.group_name) ?? [];
    list.push(`${option.option_name}${suffix}`);
    byGroup.set(option.group_name, list);
  }

  return (
    <>
      {[...byGroup.entries()].map(([group, entries]) => (
        <span key={group} className="block max-w-full truncate text-[11px] leading-snug text-neutral-400">
          <span className="font-medium text-neutral-500">{group}:</span> {entries.join(', ')}
        </span>
      ))}
    </>
  );
}

/**
 * The order's items, shown directly in the table from the API snapshot. Names,
 * quantities and line prices all come from the stored order rows — never from
 * the current product catalog — so an old order cannot change appearance when
 * a product is renamed, repriced or deleted.
 */
function OrderItemsSummary({ order }: { order: VendorOrder }) {
  const items = order.items ?? [];
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalLines = items.length;
  const visible = items.slice(0, MAX_VISIBLE_ITEM_LINES);
  const hidden = totalLines - visible.length;

  if (totalLines === 0) {
    return <span className="text-[13px] text-neutral-400">—</span>;
  }

  return (
    <div style={{ minWidth: 180 }}>
      <p className="mb-0.5 text-[11px] font-medium text-neutral-400">
        {totalQuantity} item{totalQuantity === 1 ? '' : 's'}
      </p>
      <ol className="space-y-1">
        {visible.map((item, i) => {
          const name = item.product_name?.trim() || 'Unknown item';
          const quantity = Number(item.quantity) || 1;
          const lineTotal =
            Number(item.line_total) > 0 ? Number(item.line_total) : Number(item.unit_price) || 0;
          return (
            <li key={item.product_id != null ? item.product_id : `${name}-${i}`} className="max-w-full">
              <p className="truncate text-[13px] font-medium leading-snug text-neutral-800" title={name}>
                {name}
                <span className="font-normal text-neutral-500"> ×{quantity}</span>
                {lineTotal > 0 && (
                  <span className="font-normal text-neutral-500"> · {formatItemPrice(lineTotal)}</span>
                )}
              </p>
              <OptionSummaryLines item={item} />
            </li>
          );
        })}
      </ol>
      {hidden > 0 && <p className="mt-1 text-xs font-medium text-neutral-400">+{hidden} more</p>}
    </div>
  );
}

/**
 * Compact food-only indicators (restaurant note / cutlery) derived from the
 * stored preparation-instructions snapshot. The full values still live in the
 * order drawer.
 */
function FoodIndicatorChips({ order }: { order: VendorOrder }) {
  if (order.order_type !== 'food') return null;
  const prep = readPreparationInstructions(order);
  const restaurantNote = prep.restaurant_note ?? prep.note;

  if (!restaurantNote && prep.send_cutlery == null) return null;

  return (
    <div className="mt-1.5 flex w-full flex-wrap items-center gap-1">
      {restaurantNote && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          <StickyNote className="h-3 w-3" /> Note
        </span>
      )}
      {prep.send_cutlery === false && (
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">
          No cutlery
        </span>
      )}
      {prep.send_cutlery === true && (
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">
          Cutlery
        </span>
      )}
    </div>
  );
}

const META_KEY = 'preparation_instructions';

const emptyInstructions: PreparationInstructions = {
  selected: [],
  note: null,
  restaurant_note: null,
  send_cutlery: null,
  updated_at: null,
};

function readPreparationInstructions(order: VendorOrder): PreparationInstructions {
  if (order.order_type !== 'food') return emptyInstructions;
  const stored = order.meta?.[META_KEY];
  if (!stored || typeof stored !== 'object') return emptyInstructions;
  return { ...emptyInstructions, ...(stored as PreparationInstructions) };
}

function readItemPreparationInstructions(
  order: VendorOrder,
): { orderItemId: number; note: string | null; selected: SelectedPreparationInstruction[] }[] {
  if (order.order_type !== 'food') return [];
  return (order.items ?? [])
    .map((item) => {
      const stored = item.meta?.[META_KEY];
      if (!stored || typeof stored !== 'object') return null;
      const value = stored as PreparationInstructions;
      if ((!value.selected || value.selected.length === 0) && !value.note) return null;
      return {
        orderItemId: item.id ?? 0,
        note: value.note ?? null,
        selected: value.selected ?? [],
      };
    })
    .filter((v): v is { orderItemId: number; note: string | null; selected: SelectedPreparationInstruction[] } => v !== null);
}

const flow: Record<string, string[]> = {
  // A scheduled grocery order can be accepted and packed ahead of its slot.
  // Partner dispatch is handled by the backend at its dispatch-lead time.
  SCHEDULED: ['accepted', 'cancelled'],
  PLACED: ['accepted', 'cancelled'],
  PENDING: ['accepted', 'cancelled'],
  ACCEPTED: ['preparing', 'cancelled'],
  CONFIRMED: ['preparing', 'cancelled'],
  PREPARING: ['ready', 'cancelled'],
  READY: ['out_for_delivery'],
  OUT_FOR_DELIVERY: [],
  ARRIVED: [],
};

const foodActionLabels: Record<string, string> = {
  accepted: 'Accept order',
  preparing: 'Start preparing',
  ready: 'Order prepared',
  out_for_delivery: 'Out for delivery',
};

const groceryActionLabels: Record<string, string> = {
  accepted: 'Accept order',
  preparing: 'Mark as packing your order',
  ready: 'Mark as packed your order',
  out_for_delivery: 'Out for delivery',
};

const actionLabel = (action: string, orderType: string) =>
  ((orderType === 'grocery' ? groceryActionLabels : foodActionLabels)[action] ??
    `Mark as ${action.replace(/_/g, ' ')}`);

const stepsFor = (orderType: string): { label: string; keys: string[] }[] => [
  { label: 'New order', keys: ['SCHEDULED', 'PLACED', 'PENDING'] },
  { label: 'Accepted', keys: ['ACCEPTED'] },
  { label: orderType === 'grocery' ? 'Packing your order' : 'Preparing', keys: ['PREPARING'] },
  { label: orderType === 'grocery' ? 'Packed your order' : 'Order prepared', keys: ['READY'] },
  { label: 'Out for delivery', keys: ['OUT_FOR_DELIVERY', 'PARTNER_ASSIGNED', 'PICKED_UP', 'ARRIVED'] },
  { label: 'Delivered', keys: ['DELIVERED'] },
];

const statusTabs = ['active', 'delivered', 'cancelled'];

/**
 * A scheduled grocery order is always delivered by a partner, so the vendor is
 * never offered the partner-owned statuses. The backend rejects them too.
 */
const PARTNER_OWNED_ACTIONS = ['out_for_delivery'];

const isScheduledOrder = (order: VendorOrder): boolean =>
  (order.meta?.delivery_schedule as { delivery_mode?: string } | undefined)?.delivery_mode === 'scheduled';

/**
 * Manual-assignment states: while the order is packed/ready and a partner has
 * not been claimed yet, the vendor can hand-pick the delivery partner. This is
 * the override/recovery path for Food and Grocery orders alike — a scheduled
 * Grocery order additionally defaults to manual dispatch (see
 * SCHEDULED_DISPATCHABLE_STATUSES for the PACKED gate the backend keeps).
 */
const MANUAL_ASSIGNABLE_STATUSES = ['READY', 'PACKED'];

const isManualDispatchOrder = (order: VendorOrder): boolean =>
  ['food', 'grocery'].includes(order.order_type) &&
  MANUAL_ASSIGNABLE_STATUSES.includes(order.status.toUpperCase()) &&
  order.delivery_partner_id == null;

const serviceLabel = (orderType: string): string =>
  orderType === 'grocery' ? 'Grocery delivery' : 'Food delivery';

/**
 * Only an offer that is still open means the vendor is waiting on a partner —
 * earlier rejected or expired requests must not read as pending.
 */
const pendingOffer = (order: VendorOrder): VendorDispatchLog | null =>
  (order.dispatchLogs ?? []).find((log) => log.status?.toLowerCase() === 'pending') ?? null;

function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return 'Location unavailable';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function AssignPartnerModal({
  order,
  onClose,
  onAssigned,
}: {
  order: VendorOrder;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<VendorDeliveryPartnerCandidate | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-orders', 'eligible-partners', order.id],
    queryFn: () => ordersApi.eligibleDeliveryPartners(order.id),
  });

  const assign = useMutation({
    mutationFn: (partnerId: number) => ordersApi.assignDeliveryPartner(order.id, partnerId),
    onSuccess: () => {
      toast('Delivery request sent to the partner');
      void qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      onAssigned();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error');
      setConfirming(null);
    },
  });

  const offer = pendingOffer(order);
  const { tone: requestTone, label: requestLabel } = order.delivery_partner_id
    ? ({ tone: 'success', label: 'Partner assigned' } as const)
    : offer
      ? ({ tone: 'warning', label: 'Awaiting partner acceptance' } as const)
      : ({ tone: 'info', label: 'Pick a delivery partner' } as const);

  const serviceName = serviceLabel(order.order_type);
  const partnerCount = data?.length ?? 0;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'on_job' | 'offline'>('all');

  const partnerStatus = (partner: VendorDeliveryPartnerCandidate) =>
    partner.status ?? (partner.is_online ? (partner.is_busy ? 'on_job' : 'online') : 'offline');

  const assignable = (partner: VendorDeliveryPartnerCandidate) =>
    partner.available_for_assignment ?? partner.available;

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((partner) => {
      if (term && !partner.name.toLowerCase().includes(term)) return false;
      if (filter !== 'all' && partnerStatus(partner) !== filter) return false;
      return true;
    });
  }, [data, query, filter]);

  const select = (partner: VendorDeliveryPartnerCandidate) => {
    if (assign.isPending) return;
    if (!assignable(partner)) {
      toast('This partner cannot be assigned for this order right now', 'error');
      return;
    }
    setConfirming(partner);
  };

  const confirmAndSend = (partner: VendorDeliveryPartnerCandidate) => {
    if (assign.isPending) return;
    assign.mutate(partner.id);
  };

  const cancelConfirm = () => {
    if (assign.isPending) return;
    setConfirming(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-float">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-neutral-900">Assign delivery partner</p>
              <p className="truncate text-xs text-neutral-400">{order.order_number}</p>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-neutral-500 hover:bg-ink-50">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
          <Badge tone="info">
            <Truck className="h-3 w-3" /> {serviceName}
          </Badge>
          <Badge tone="neutral">Manual assignment</Badge>
          <Badge tone={requestTone}>{requestLabel}</Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {confirming ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Confirm partner
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={confirming.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{confirming.name}</p>
                    <p className="text-xs text-neutral-500">
                      {serviceName} · {formatDistanceKm(confirming.distance_km)} away
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-brand-700">
                  A delivery request will be sent to {confirming.name}. The order stays
                  unassigned until they accept it.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={assign.isPending}
                  onClick={cancelConfirm}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={assign.isPending}
                  onClick={() => confirmAndSend(confirming)}
                >
                  {assign.isPending && assign.variables === confirming.id ? 'Sending…' : 'Assign partner'}
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : !data || data.length === 0 ? (
            <div className="py-10 text-center">
              <Truck className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-700">No {serviceName.toLowerCase()} delivery partners registered</p>
              <p className="text-xs text-neutral-400">
                No approved {serviceName.toLowerCase()} partners exist yet. Ask a partner to register and get approved, then refresh.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => void refetch()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {rows.length} of {partnerCount} {serviceName.toLowerCase()} partner{partnerCount === 1 ? '' : 's'}
                </p>
                <button
                  onClick={() => void refetch()}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    placeholder="Search partner name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-9"
                  />
                </div>
                <select
                  className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                >
                  <option value="all">All statuses</option>
                  <option value="online">Online</option>
                  <option value="on_job">On a job</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-400">No partners match this search or filter.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((partner: VendorDeliveryPartnerCandidate) => {
                    const status = partnerStatus(partner);
                    const canAssign = assignable(partner);
                    const unavailable = !canAssign || !partner.has_current_location;
                    return (
                      <div
                        key={partner.id}
                        className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5"
                      >
                        <Avatar name={partner.name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-neutral-900">{partner.name}</p>
                            {status === 'offline' ? (
                              <Badge tone="neutral">offline</Badge>
                            ) : status === 'on_job' ? (
                              <Badge tone="warning">On a job</Badge>
                            ) : (
                              <Badge tone="success">
                                <Wifi className="h-3 w-3" /> Available
                              </Badge>
                            )}
                            {canAssign && partner.is_busy && (
                              <Badge tone="warning">
                                On batch · {partner.active_batch_order_count} stop{partner.active_batch_order_count === 1 ? '' : 's'}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                            <span className={partner.distance_km == null ? 'italic text-neutral-400' : 'text-neutral-600'}>
                              {partner.distance_km == null ? 'Location unavailable' : formatDistanceKm(partner.distance_km)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-400" /> {partner.rating > 0 ? partner.rating.toFixed(1) : 'New'}
                            </span>
                            {partner.vehicle_type && <span className="capitalize">{partner.vehicle_type}</span>}
                            {partner.service_label && <span className="text-neutral-400">{partner.service_label}</span>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={assign.isPending ? 'secondary' : 'primary'}
                          disabled={assign.isPending || unavailable}
                          title={
                            status === 'offline'
                              ? 'This partner is offline'
                              : unavailable
                                ? 'This partner cannot be assigned for this order right now'
                                : undefined
                          }
                          onClick={() => select(partner)}
                        >
                          {assign.isPending && assign.variables === partner.id
                            ? 'Sending…'
                            : status === 'offline'
                              ? 'Offline'
                              : unavailable
                                ? 'Unavailable'
                                : 'Assign'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] text-neutral-400">
                Partners far from the pickup or offline are still listed for reference — the recipient still accepts the request
                and nothing is assigned until they do.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const actionsFor = (order: VendorOrder): string[] =>
  (flow[order.status.toUpperCase()] ?? []).filter(
    (s) => !(isScheduledOrder(order) && PARTNER_OWNED_ACTIONS.includes(s)),
  );

const canCancel = (order: VendorOrder): boolean => (flow[order.status.toUpperCase()] ?? []).includes('cancelled');

function ScheduledSlotNotice({ order, className }: { order: VendorOrder; className?: string }) {
  const schedule = order.meta?.delivery_schedule as
    | { delivery_mode?: string; slot_date?: string; start_time?: string; end_time?: string; label?: string }
    | undefined;

  const scheduled =
    schedule?.delivery_mode === 'scheduled' &&
    !!schedule.slot_date &&
    !['DELIVERED', 'CANCELLED'].includes(order.status.toUpperCase());

  if (!scheduled) {
    return null;
  }

  const windowLabel =
    schedule.label ??
    `${(schedule.start_time ?? '').slice(0, 5)} - ${(schedule.end_time ?? '').slice(0, 5)}`;

  return (
    <p className={`flex items-center gap-1 text-[11px] text-brand-700 ${className ?? ''}`}>
      <CalendarClock className="h-3 w-3 shrink-0" />
      <span className="font-semibold">Scheduled</span>
      {new Date(`${schedule.slot_date}T${(schedule.start_time ?? '00:00').slice(0, 5)}`).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}
      <span className="text-brand-600">&middot; {windowLabel}</span>
    </p>
  );
}

function OrderStepper({ status, orderType }: { status: string; orderType: string }) {
  const current = status.toUpperCase();
  const steps = stepsFor(orderType);
  const index = steps.findIndex((s) => s.keys.includes(current));
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const reached = index === -1 ? current === 'CANCELLED' ? i < 0 : false : i < index;
        const active = i === index;
        return (
          <div key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  active
                    ? 'bg-brand-600 text-white'
                    : reached
                      ? 'bg-emerald-500 text-white'
                      : 'bg-ink-100 text-neutral-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={`whitespace-nowrap text-[10px] ${active ? 'font-semibold text-brand-700' : reached ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 mb-4 h-0.5 flex-1 rounded ${i < index ? 'bg-emerald-400' : 'bg-ink-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderDrawer({ order, onClose, onAssign }: { order: VendorOrder; onClose: () => void; onAssign: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) => ordersApi.setStatus(order.id, status, note),
    onMutate: async ({ status }) => {
      await qc.cancelQueries({ queryKey: ['vendor-orders'] });
      const previousStatus = order.status;
      patchOrderInListCaches(qc, order.id, { status: status.toUpperCase() });
      return { previousStatus };
    },
    onError: (err, _variables, context) => {
      if (context) {
        patchOrderInListCaches(qc, order.id, { status: context.previousStatus });
      }
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    },
    onSuccess: (updated) => {
      toast('Order updated');
      if (updated) {
        patchOrderInListCaches(qc, order.id, updated);
      }
      onClose();
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['vendor-orders'] });
    },
  });

  const current = order.status.toUpperCase();
  const next = flow[current] ?? [];

  // Food-only. Values come from the order response's stored snapshot, so
  // historical orders stay readable even if the wording changes later.
  const prep = readPreparationInstructions(order);
  const itemPrep = readItemPreparationInstructions(order);
  const restaurantNote = prep.restaurant_note ?? prep.note;
  const noCutlery = prep.send_cutlery === false;
  const hasInstructions =
    prep.selected.length > 0 || !!restaurantNote || noCutlery || itemPrep.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-float animate-slide-up">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-bold text-neutral-900">{order.order_number}</p>
            <p className="text-xs text-neutral-400">{timeFromNow(order.created_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <OrderStepper status={order.status} orderType={order.order_type} />

          <div className="flex items-center justify-between">
            <StatusBadge status={order.status.toLowerCase()} />
            <span className="text-xs text-neutral-400 capitalize">{order.payment_method ?? '—'} · {order.payment_status}</span>
          </div>

          <ScheduledSlotNotice order={order} />

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Customer</p>
            <p className="font-semibold text-neutral-900">{order.user?.name ?? '—'}</p>
            <p className="text-sm text-neutral-500">{order.user?.phone ?? ''}</p>
          </div>

          {order.customer_note && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Note</p>
              <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-neutral-700">{order.customer_note}</p>
            </div>
          )}

          {hasInstructions && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Food instructions
              </p>

              {prep.selected.length > 0 && (
                <ul className="space-y-1">
                  {prep.selected.map((instruction) => (
                    <li key={instruction.key} className="text-sm font-medium text-amber-900">
                      {instruction.emoji ? `${instruction.emoji} ` : ''}
                      {instruction.label}
                    </li>
                  ))}
                </ul>
              )}

              {itemPrep.map((item) => {
                const line = (order.items ?? []).find((i) => i.id === item.orderItemId);
                return (
                  <div key={item.orderItemId} className="mt-2 text-sm text-amber-900">
                    {item.selected.length > 0 && (
                      <p className="font-medium">
                        {line?.product_name ?? 'Item'}:{' '}
                        {item.selected.map((s) => s.label).join(', ')}
                      </p>
                    )}
                    {item.note && <p className="text-amber-800">Note: {item.note}</p>}
                  </div>
                );
              })}

              {restaurantNote && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Restaurant note
                  </p>
                  <p className="mt-0.5 text-sm text-amber-900">{restaurantNote}</p>
                </div>
              )}

              {noCutlery && (
                <p className="mt-2 text-sm font-medium text-amber-900">Cutlery: Don't send cutlery</p>
              )}

              <p className="mt-2 text-[11px] text-amber-700/80">
                Customer requests only. Confirm availability with the kitchen before promising.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Items</p>
            <div className="overflow-hidden rounded-xl border border-ink-100">
              {(order.items ?? []).map((it) => (
                <div key={it.id ?? it.product_name + it.product_id} className="flex items-start gap-3 border-b border-ink-100 px-3 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{it.product_name}</p>
                    {it.selected_options && it.selected_options.length > 0 && (
                      <>
                        <ul className="mt-1 space-y-0.5">
                          {it.selected_options.map((o) => (
                            <li key={`${o.group_id}-${o.option_id}`} className="text-xs text-neutral-500">
                              <span className="font-medium text-neutral-600">{o.group_name}:</span> {o.option_name}
                              {optionPrice(o) > 0 && <span className="text-neutral-400"> (+{formatCurrency(optionPrice(o))})</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-xs text-neutral-400">
                          {formatCurrency(it.unit_price)} × {it.quantity}
                        </p>
                      </>
                    )}
                    {(!it.selected_options || it.selected_options.length === 0) && (
                      <p className="mt-1 text-xs text-neutral-400">×{it.quantity}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(it.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-ink-50 p-3">
            <div className="flex justify-between text-sm"><span className="text-neutral-500">Subtotal</span><span>{formatCurrency(order.subtotal ?? 0)}</span></div>
            {Number(order.discount_amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm"><span className="text-neutral-500">Discount</span><span className="text-emerald-600">−{formatCurrency(order.discount_amount ?? 0)}</span></div>
            )}
            {Number(order.delivery_fee ?? 0) > 0 && (
              <div className="flex justify-between text-sm"><span className="text-neutral-500">Delivery</span><span>{formatCurrency(order.delivery_fee ?? 0)}</span></div>
            )}
            {Number(order.tax_amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm"><span className="text-neutral-500">Tax (incl.)</span><span>{formatCurrency(order.tax_amount ?? 0)}</span></div>
            )}
            <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-sm font-bold text-neutral-900">
              <span>Total</span><span>{formatCurrency(order.total_amount)}</span>
            </div>
            {order.delivery_partner_id && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
                <MapPin className="h-3.5 w-3.5" /> Delivery partner assigned
                {order.deliveryPartner?.user?.name ? ` · ${order.deliveryPartner.user.name}` : ''}
              </div>
            )}
          </div>

          {isManualDispatchOrder(order) && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Delivery partner</p>
                {order.delivery_partner_id == null && (
                  <Button
                    size="sm"
                    variant={pendingOffer(order) ? 'secondary' : 'primary'}
                    disabled={mutation.isPending}
                    onClick={onAssign}
                  >
                    {pendingOffer(order) ? 'Change partner' : 'Assign delivery partner'}
                  </Button>
                )}
              </div>
              {order.delivery_partner_id == null ? (
                pendingOffer(order) ? (
                  <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Request sent — awaiting partner acceptance</p>
                      <p className="text-xs text-brand-600">
                        Requested {timeFromNow(pendingOffer(order)?.created_at ?? order.created_at)}. The order is
                        only assigned once they accept.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Pick a nearby {order.order_type === 'grocery' ? 'grocery' : 'food'} partner to deliver this order.
                  </p>
                )
              ) : (
                <p className="text-sm text-neutral-700">
                  {order.deliveryPartner?.user?.name ?? 'Partner'} is delivering this order.
                </p>
              )}
            </div>
          )}

          {(next.length > 0 || canCancel(order)) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Update status</p>
              <div className="flex flex-wrap gap-2">
                {next
                  .filter((s) => s !== 'cancelled')
                  .map((s) => (
                    <Button key={s} size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ status: s })}>
                      {actionLabel(s, order.order_type)}
                    </Button>
                  ))}
                {canCancel(order) && (
                  <Button size="sm" variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate({ status: 'cancelled', note: 'Cancelled by vendor' })}>
                    Cancel order
                  </Button>
                )}
              </div>
            </div>
          )}

          {!!order.statusHistory?.length && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">History</p>
              <div className="space-y-2">
                {order.statusHistory.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />
                    <div>
                      <p className="font-medium capitalize text-neutral-800">{h.status.toLowerCase().replace(/_/g, ' ')}</p>
                      <p className="text-xs text-neutral-400">{formatDateTime(h.created_at)}{h.notes ? ` · ${h.notes}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ order }: { order: VendorOrder }) {
  const qc = useQueryClient();
  const next = actionsFor(order);
  const action = next[0];

  const mutation = useMutation({
    mutationFn: (status: string) => ordersApi.setStatus(order.id, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['vendor-orders'] });
      const previousStatus = order.status;
      patchOrderInListCaches(qc, order.id, { status: status.toUpperCase() });
      return { previousStatus };
    },
    onError: (err, _status, context) => {
      if (context) {
        patchOrderInListCaches(qc, order.id, { status: context.previousStatus });
      }
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    },
    onSuccess: (updated) => {
      toast('Order updated');
      if (updated) {
        patchOrderInListCaches(qc, order.id, updated);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['vendor-orders'] });
    },
  });

  if (!action) return null;

  return (
    <Button
      size="sm"
      variant={action === 'ready' ? 'primary' : 'secondary'}
      disabled={mutation.isPending}
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate(action);
      }}
    >
      {mutation.isPending ? 'Updating…' : actionLabel(action, order.order_type)}
    </Button>
  );
}

export function OrdersPage() {
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VendorOrder | null>(null);
  const [assignFor, setAssignFor] = useState<VendorOrder | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-orders', tab, page, search],
    queryFn: () => ordersApi.list({ page, search: search || null, status: tab === 'active' ? null : tab }),
    // Live-ish fallback while Reverb is not wired to the dashboards: poll only
    // while the tab is visible and refresh immediately on refocus. A status
    // change made by a partner/customer/admin shows without a manual reload.
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const viewOrder = (id: number) => {
    void ordersApi
      .get(id)
      .then(setSelected)
      .catch((err) => toast(err instanceof Error ? err.message : 'Failed to load order', 'error'));
  };

  // Keep an open drawer in sync with the list cache so a status change made
  // elsewhere (partner/admin, or this session's optimistic patch) is reflected
  // without closing and reopening the drawer.
  useEffect(() => {
    if (!selected) return;
    const fresh = data?.data.find((o) => o.id === selected.id);
    if (fresh && fresh.status !== selected.status) {
      setSelected((prev) => (prev && prev.id === fresh.id ? { ...prev, status: fresh.status } : prev));
    }
  }, [data, selected]);

  const reloadSelected = () => {
    if (!selected) return;
    void ordersApi
      .get(selected.id)
      .then(setSelected)
      .catch((err) => toast(err instanceof Error ? err.message : 'Failed to load order', 'error'));
  };

  return (
    <>
      <PageHeader title="Orders" description="Accept, prepare and track incoming orders" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-ink-100 bg-white p-1">
          {statusTabs.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-brand-600 text-white' : 'text-neutral-600 hover:bg-ink-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search order or customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-x-auto px-0 py-0">
        {isLoading ? (
          <Skeleton className="p-6" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <Table>
              <THead>
<THeadRow>
                    <THeadCell>Order</THeadCell>
                    <THeadCell>Customer</THeadCell>
                    <THeadCell>Items</THeadCell>
                    <THeadCell>Status</THeadCell>
                    <THeadCell className="text-right">Total</THeadCell>
                    <THeadCell className="text-right">Action</THeadCell>
                  </THeadRow>
              </THead>
              <TBody>
                {data.data.map((o) => (
                  <TRow key={o.id} clickable onClick={() => viewOrder(o.id)}>
                    <TCell>
                      <p className="font-medium text-neutral-900">{o.order_number}</p>
                      <p className="text-xs text-neutral-400">{timeFromNow(o.created_at)}</p>
                    </TCell>
                    <TCell className="text-sm">{o.user?.name ?? '—'}</TCell>
                    <TCell style={{ whiteSpace: 'normal' }} className="align-top">
                      <OrderItemsSummary order={o} />
                      <FoodIndicatorChips order={o} />
                    </TCell>
                    <TCell>
                      <StatusBadge status={o.status.toLowerCase()} />
                      <ScheduledSlotNotice order={o} className="mt-1" />
                    </TCell>
                    <TCell className="text-right font-medium">{formatCurrency(o.total_amount)}</TCell>
                    <TCell className="text-right">
                      <QuickAction order={o} />
                      {isManualDispatchOrder(o) && o.delivery_partner_id == null && (
                        <Button
                          size="sm"
                          variant={pendingOffer(o) ? 'secondary' : 'outline'}
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignFor({ ...o });
                          }}
                        >
                          {pendingOffer(o) ? 'Change partner' : 'Assign partner'}
                        </Button>
                      )}
                    </TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {selected && <OrderDrawer order={selected} onClose={() => setSelected(null)} onAssign={() => setAssignFor(selected)} />}
      {assignFor && (
        <AssignPartnerModal
          order={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={reloadSelected}
        />
      )}
    </>
  );
}