import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, MapPin, Navigation, RefreshCw, Search, Star, Truck, Wifi } from 'lucide-react';
import { ordersApi, refundsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { Paginated } from '@/typings/api';
import type { AdminDeliveryPartnerCandidate, AdminOrder, AdminOrderFinancial } from '@/typings/models';

const flow: Record<string, string[]> = {
  PLACED: ['pending', 'cancelled'],
  PENDING: ['confirmed', 'cancelled'],
  CONFIRMED: ['preparing', 'cancelled'],
  PREPARING: ['ready', 'cancelled'],
  READY: ['out_for_delivery', 'cancelled'],
  OUT_FOR_DELIVERY: ['arrived', 'delivered', 'cancelled'],
  ARRIVED: ['delivered', 'cancelled'],
};

const ordinal = (s: string) => s.toLowerCase().replace(/_/g, ' ');
const serviceOf = (o: AdminOrder) => o.service ?? o.order_type;

/**
 * Optimistically patch one order row across every cached admin-orders page so a
 * status change shows instantly and can be rolled back if the server rejects it.
 */
function patchOrderInListCaches(qc: ReturnType<typeof useQueryClient>, orderId: number, patch: Partial<AdminOrder>) {
  qc.setQueriesData<Paginated<AdminOrder>>({ queryKey: ['admin-orders'] }, (old) => {
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

function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return 'Location unavailable';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const serviceLabel = (orderType: string): string =>
  orderType === 'grocery' ? 'Grocery delivery' : 'Food delivery';

function AssignPartnerModal({
  order,
  onClose,
  onAssigned,
}: {
  order: AdminOrder;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<AdminDeliveryPartnerCandidate | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-order-eligible', order.id],
    queryFn: () => ordersApi.eligibleDeliveryPartners(order.id),
  });

  const assign = useMutation({
    mutationFn: (partnerId: number) => ordersApi.assignDeliveryPartner(order.id, partnerId),
    onSuccess: () => {
      toast('Delivery request sent to the partner');
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
      void qc.invalidateQueries({ queryKey: ['admin-order-detail', order.id] });
      onAssigned();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error');
      setConfirming(null);
    },
  });

  const serviceName = serviceLabel(serviceOf(order));
  const partnerCount = data?.length ?? 0;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'on_job' | 'offline'>('all');

  const partnerStatus = (partner: AdminDeliveryPartnerCandidate) =>
    partner.status ?? (partner.is_online ? (partner.is_busy ? 'on_job' : 'online') : 'offline');

  const assignable = (partner: AdminDeliveryPartnerCandidate) =>
    partner.available_for_assignment ?? partner.available;

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((partner) => {
      if (term && !partner.name.toLowerCase().includes(term)) return false;
      if (filter !== 'all' && partnerStatus(partner) !== filter) return false;
      return true;
    });
  }, [data, query, filter]);

  const select = (partner: AdminDeliveryPartnerCandidate) => {
    if (assign.isPending) return;
    if (!assignable(partner)) {
      toast('This partner cannot be assigned for this order right now', 'error');
      return;
    }
    setConfirming(partner);
  };

  const cancelConfirm = () => {
    if (assign.isPending) return;
    setConfirming(null);
  };

  return (
    <Modal open onOpenChange={(open) => !open && !assign.isPending && onClose()} title="Assign delivery partner" description={order.order_number} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="info">
          <Truck className="h-3 w-3" /> {serviceName}
        </Badge>
        <Badge tone="neutral">Manual assignment</Badge>
      </div>

      {confirming ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Confirm partner</p>
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
              A delivery request will be sent to {confirming.name}. The order stays unassigned
              until they accept it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" disabled={assign.isPending} onClick={cancelConfirm}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={assign.isPending}
              loading={assign.isPending && assign.variables === confirming.id}
              onClick={() => assign.mutate(confirming.id)}
            >
              Assign partner
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <Skeleton rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <div className="py-10 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-700">No {serviceName.toLowerCase()} delivery partners registered</p>
          <p className="text-xs text-neutral-400">
            No approved {serviceName.toLowerCase()} partners exist yet. Approve a partner in the delivery partners section, then refresh.
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
              {rows.map((partner) => {
                const status = partnerStatus(partner);
                const canAssign = assignable(partner);
                const unavailable = !canAssign || !partner.has_current_location;
                return (
                  <div key={partner.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5">
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
                        {!unavailable && partner.is_busy && (
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
            Partners far from the pickup or offline are still listed for reference — the recipient still accepts the request and
            nothing is assigned until they do.
          </p>
        </>
      )}
    </Modal>
  );
}

export function OrdersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [assignFor, setAssignFor] = useState<AdminOrder | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-orders', page, search, status, service],
    queryFn: () =>
      ordersApi.list({ page, search: search || null, status: status || null, service: (service || null) as 'food' | 'grocery' | 'ride' | null }),
    // Fallback polling while Reverb is not wired to admin-web; pause when hidden.
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-order-detail', expandedId],
    queryFn: () => ordersApi.get(expandedId as number),
    enabled: expandedId != null,
    staleTime: 60_000,
  });

  // Keep the expanded order detail in sync with list changes/poll updates.
  useEffect(() => {
    if (expandedId == null || !detailQuery.data) return;
    const fresh = data?.data.find((o) => o.id === expandedId);
    if (fresh && fresh.status !== detailQuery.data.status) {
      qc.setQueryData(['admin-order-detail', expandedId], (prev: AdminOrder | undefined) =>
        prev ? { ...prev, status: fresh.status } : prev,
      );
    }
  }, [data, detailQuery.data, expandedId, qc]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => ordersApi.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin-orders'] });
      let previousStatus: string | undefined;
      qc.setQueriesData<Paginated<AdminOrder>>({ queryKey: ['admin-orders'] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        const data = old.data.map((order) => {
          if (order.id !== id) return order;
          previousStatus = order.status;
          return { ...order, status: status.toUpperCase() };
        });
        return { ...old, data };
      });
      return { id, previousStatus };
    },
    onError: (err, _variables, context) => {
      if (context && context.previousStatus) {
        patchOrderInListCaches(qc, context.id, { status: context.previousStatus });
      }
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    },
    onSuccess: (updated) => {
      toast('Order status updated');
      if (updated) patchOrderInListCaches(qc, updated.id, updated as Partial<AdminOrder>);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: number; amount: number; reason?: string }) =>
      refundsApi.refundCancelledOrder(id, { amount, reason }),
    onSuccess: () => {
      toast('Order refunded, revenue reversed on dashboard and vendor earnings');
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['earnings'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Refund failed', 'error'),
  });

  return (
    <>
      <PageHeader title="Orders" description="All food, grocery and ride orders" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search order number, ride number or customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="w-72 pl-9"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
          value={service}
          onChange={(e) => {
            setService(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All services</option>
          <option value="food">Food</option>
          <option value="grocery">Grocery</option>
          <option value="ride">Ride</option>
        </select>
        <select
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.keys(flow).map((s) => (
            <option key={s} value={s}>
              {ordinal(s)}
            </option>
          ))}
        </select>
      </div>

      <Card className="px-0 py-0">
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
                  <THeadCell>Type</THeadCell>
                  <THeadCell>Customer</THeadCell>
                  <THeadCell>{service === 'ride' ? 'Driver' : 'Vendor / Driver'}</THeadCell>
                  <THeadCell>Total</THeadCell>
                  <THeadCell>Payment</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.length === 0 && (
                  <TRow>
                    <TCell colSpan={8} className="text-center text-neutral-400">
                      No orders or rides found.
                    </TCell>
                  </TRow>
                )}
                {data.data.map((o) => {
                  const key = o.status.toUpperCase();
                  const next = flow[key] ?? [];
                  const isRide = serviceOf(o) === 'ride';
                  const expanded = expandedId === o.id;

                  return (
                    <Fragment key={o.id}>
                      <TRow>
                        <TCell>
                          <p className="font-semibold text-neutral-900">{o.order_number}</p>
                          <p className="text-xs text-neutral-400">{formatDateTime(o.created_at)}</p>
                        </TCell>
                        <TCell>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              isRide ? 'bg-violet-50 text-violet-700' : serviceOf(o) === 'grocery' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'
                            }`}
                          >
                            {serviceOf(o)}
                          </span>
                        </TCell>
                        <TCell className="text-sm">{o.user?.name ?? '—'}</TCell>
                        <TCell className="text-sm">
                          {isRide ? (
                            <>
                              <p className="font-medium text-neutral-800">{o.driver?.name ?? '—'}</p>
                              <p className="text-xs text-neutral-400">
                                {o.vehicle_type ?? '—'}
                                {o.driver?.vehicle_number ? ` · ${o.driver.vehicle_number}` : ''}
                              </p>
                            </>
                          ) : (
                            o.vendor?.business_name ?? '—'
                          )}
                        </TCell>
                        <TCell className="font-medium">{formatCurrency(o.total_amount)}</TCell>
                        <TCell>
                          <p className="text-sm capitalize">{o.payment_method ?? '—'}</p>
                          <p className="text-xs text-neutral-400">{o.payment_status.toLowerCase()}</p>
                        </TCell>
                        <TCell>
                          <StatusBadge status={o.status} />
                        </TCell>
                        <TCell className="text-right">
                          {!isRide && (
                            <>
                              {o.manual_assignable && (
                                <button
                                  type="button"
                                  onClick={() => setAssignFor(o)}
                                  className="mr-2 inline-flex h-8 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                                >
                                  <Truck className="h-3.5 w-3.5" />
                                  Assign partner
                                </button>
                              )}
                              {next.length > 0 && (
                                <select
                                  className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs"
                                  value=""
                                  disabled={statusMutation.isPending}
                                  onChange={(e) => {
                                    if (e.target.value) statusMutation.mutate({ id: o.id, status: e.target.value });
                                  }}
                                >
                                  <option value="">Advance…</option>
                                  {next.map((s) => (
                                    <option key={s} value={s}>
                                      {ordinal(s)}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {['CANCELLED', 'CANCELED'].includes(o.status ?? '') &&
                                ['wallet', 'card', 'upi', 'netbanking', 'net_banking', 'online', 'prepaid', 'internet_banking'].includes(
                                  (o.payment_method ?? '').toLowerCase(),
                                ) && ['paid', 'success'].includes((o.payment_status ?? '').toLowerCase()) && (
                                  <button
                                    type="button"
                                    disabled={refundMutation.isPending}
                                    onClick={() => {
                                      const amount = Number(o.total_amount ?? 0);
                                      const reason = window.prompt('Refund reason (default: admin refund for cancelled order)') || 'admin refund for cancelled order';
                                      refundMutation.mutate({ id: o.id, amount, reason });
                                    }}
                                    className="mt-2 inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                                  >
                                    Refund
                                  </button>
                                )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : o.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Details
                          </button>
                        </TCell>
                      </TRow>
                      {expanded && (isRide ? <RideDetailRow order={o} /> : <ItemDetailRow order={o} detail={detailQuery.isFetching ? undefined : detailQuery.data} detailLoading={detailQuery.isFetching} onAssign={() => setAssignFor(o)} />)}
                    </Fragment>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {assignFor && (
        <AssignPartnerModal order={assignFor} onClose={() => setAssignFor(null)} onAssigned={() => void detailQuery.refetch()} />
      )}
    </>
  );
}

function RideDetailRow({ order }: { order: AdminOrder }) {
  const fare = [
    { label: 'Base fare', value: order.base_fare },
    { label: 'Distance charge', value: order.distance_charge },
    { label: 'Time charge', value: order.time_charge },
    { label: 'Waiting charge', value: order.waiting_charge },
    { label: 'Platform fee', value: order.platform_fee },
  ];
  const discount = Number(order.discount_amount) || 0;
  const pickup = order.pickup;
  const drop = order.drop;
  const pickupCoords =
    pickup && pickup.latitude != null && pickup.longitude != null ? `(${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)})` : null;
  const dropCoords = drop && drop.latitude != null && drop.longitude != null ? `(${drop.latitude.toFixed(4)}, ${drop.longitude.toFixed(4)})` : null;
  const customerPaid = order.final_fare ?? order.estimated_fare ?? order.total_amount;

  return (
    <TRow>
      <TCell colSpan={8} className="bg-neutral-50/70 px-6 py-4">
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Locations</p>
            <p className="flex items-start gap-1.5 text-neutral-700">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              {pickup?.address ?? '—'}
              {pickupCoords && <span className="text-xs text-neutral-400">{pickupCoords}</span>}
            </p>
            <p className="flex items-start gap-1.5 text-neutral-700">
              <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {drop?.address ?? '—'}
              {dropCoords && <span className="text-xs text-neutral-400">{dropCoords}</span>}
            </p>
            <p className="text-xs text-neutral-500">
              {order.distance_km != null ? `${order.distance_km} km` : '—'} ·{' '}
              {order.duration_min != null ? `${order.duration_min} min` : '—'}
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Fare breakdown</p>
            {fare.map((f) => (
              <p key={f.label} className="flex justify-between text-neutral-700">
                <span>{f.label}</span>
                <span>{formatCurrency(f.value ?? 0)}</span>
              </p>
            ))}
            {discount > 0 && (
              <p className="flex justify-between text-neutral-700">
                <span>Discount</span>
                <span>−{formatCurrency(discount)}</span>
              </p>
            )}
            <p className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-neutral-900">
              <span>Customer paid ({order.payment_method ?? '—'})</span>
              <span>{formatCurrency(customerPaid)}</span>
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Earnings</p>
            <p className="flex justify-between text-neutral-700">
              <span>Driver earning</span>
              <span>{formatCurrency(order.driver_earning ?? 0)}</span>
            </p>
            <p className="flex justify-between text-neutral-700">
              <span>Admin commission</span>
              <span>{formatCurrency(order.admin_commission ?? 0)}</span>
            </p>
            {order.commission_percentage != null && (
              <p className="text-xs text-neutral-400">Commission rate {order.commission_percentage}% of customer paid</p>
            )}
            <p className="pt-1 text-xs text-neutral-500">
              <span className="font-semibold text-neutral-700">Completed:</span> {formatDateTime(order.completed_at)}
            </p>
          </div>
        </div>
      </TCell>
    </TRow>
  );
}

function ItemDetailRow({
  order,
  detail,
  detailLoading,
  onAssign,
}: {
  order: AdminOrder;
  detail?: AdminOrder | null;
  detailLoading: boolean;
  onAssign: () => void;
}) {
  const items = order.items ?? [];
  const financial = detail?.financial;
  const offer = detail?.active_dispatch_offer;
  const partner = detail?.delivery_partner;

  return (
    <TRow>
      <TCell colSpan={8} className="bg-neutral-50/70 px-6 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Items</p>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No items found for this order.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const options = item.selected_options ?? [];
              return (
                <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <p className="font-medium text-neutral-900">
                      {item.product_name}
                      <span className="text-neutral-400"> × {item.quantity}</span>
                    </p>
                    <p className="font-semibold text-neutral-900">{formatCurrency(item.line_total)}</p>
                  </div>
                  <div className="mt-0.5 flex justify-between text-xs text-neutral-500">
                    <span>{formatCurrency(item.unit_price)} each</span>
                  </div>
                  {options.length > 0 && (
                    <div className="mt-2 space-y-0.5 border-t border-neutral-100 pt-2">
                      {options.map((opt) => (
                        <p key={`${opt.group_id}-${opt.option_id}`} className="flex flex-wrap justify-between gap-2 text-xs text-neutral-600">
                          <span>
                            <span className="text-neutral-400">{opt.group_name}</span>: {opt.option_name}
                          </span>
                          {Number(opt.price) > 0 && <span className="text-emerald-600">+{formatCurrency(opt.price)}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {partner || offer || order.manual_assignable ? (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Delivery partner</p>
              {order.manual_assignable && (
                <Button size="sm" variant="outline" onClick={onAssign}>
                  <Truck className="h-3.5 w-3.5" /> Assign delivery partner
                </Button>
              )}
            </div>
            {partner ? (
              <p className="text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">{partner.name ?? 'Partner'}</span> is delivering this order.
              </p>
            ) : offer ? (
              <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                <Truck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Request sent — awaiting partner acceptance</p>
                  <p className="text-xs text-brand-600">
                    The order is only assigned once the partner accepts.
                    {offer.mode.includes('manual')
                      ? ` Manual assignment${offer.assigned_by ? ` by ${offer.assigned_by}` : ''}.`
                      : ` Automatic dispatch offer.`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Pick a nearby {serviceOf(order) === 'grocery' ? 'grocery' : 'food'} partner to deliver this order.
              </p>
            )}
          </div>
        ) : null}

        {detailLoading ? (
          <Skeleton className="mt-4 h-72 w-full" />
        ) : financial ? (
          <div className="mt-4 space-y-3">
            <FinancialSummary financial={financial} order={order} />
            <OrderBill financial={financial} />
            {(financial.payments.length > 0 || financial.wallet_transactions.length > 0) && <CustomerPayment financial={financial} />}
            {(financial.vendor_settlement ?? null) !== null && <VendorSettlement financial={financial} />}
            {financial.partner_earnings.length > 0 && <PartnerEarnings financial={financial} />}
            {(Number(financial.platform.platform_fee) > 0 || Number(financial.platform.commission_fee ?? 0) > 0 || Number(financial.platform.admin_funded_delivery) > 0) && (
              <PlatformFinancials financial={financial} />
            )}
            {financial.refunds.length > 0 && <Refunds financial={financial} />}
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">No financial data found for this order.</p>
        )}
      </TCell>
    </TRow>
  );
}

/** Preserve decimal paise when the stored record carries them (e.g. ₹44.85 commission). */
const formatMoney = (value: string | number | null | undefined): string => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '₹0';
  const decimals = Number.isInteger(num) ? 0 : 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

const financialStatusTone: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  earned: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-slate-50 text-slate-700 ring-slate-200',
  approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  initiated: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  reversed: 'bg-red-50 text-red-700 ring-red-200',
};

function FinancialStatusPill({ status, className }: { status?: string | null; className?: string }) {
  const key = (status ?? '').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        financialStatusTone[key] ?? 'bg-neutral-100 text-neutral-700 ring-neutral-200',
        className,
      )}
    >
      {(status ?? '—').toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}

function FinancialSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</span>
        <span className="flex items-center gap-2">
          {badge}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />}
        </span>
      </button>
      {open && <div className="border-t border-neutral-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong,
  positive,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className={cn('text-neutral-900', strong && 'font-semibold', positive && 'text-emerald-600', negative && 'text-rose-600')}>
        {value}
      </span>
    </div>
  );
}

function FinancialSummary({ financial, order }: { financial: AdminOrderFinancial; order: AdminOrder }) {
  const paid = financial.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const earning = financial.partner_earnings.reduce((sum, e) => sum + Number(e.amount), 0);
  const settlement = financial.vendor_settlement;

  return (
    <FinancialSection title="Financial Summary">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <MoneyRow label="Customer paid" value={formatMoney(paid)} strong />
        <MoneyRow label="Order total" value={formatMoney(order.total_amount)} />
        <MoneyRow label="Platform commission" value={formatMoney(financial.platform.commission_fee)} />
        <MoneyRow label="Vendor net payout" value={formatMoney(settlement?.net_payable ?? order.net_vendor_payout)} />
        <MoneyRow label="Admin-funded delivery" value={formatMoney(financial.platform.admin_funded_delivery)} />
        <MoneyRow label="Partner earning" value={formatMoney(earning)} />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600">Payment</span>
          <span className="flex items-center gap-2">
            <FinancialStatusPill status={order.payment_status} />
            {(order.payment_method ?? '').toLowerCase() === 'online' ? <span className="text-xs text-neutral-500">online</span> : <span className="text-xs text-neutral-500">{order.payment_method ?? '—'}</span>}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600">Vendor payout</span>
          <FinancialStatusPill status={order.vendor_payout_status} />
        </div>
      </div>
    </FinancialSection>
  );
}

function OrderBill({ financial }: { financial: AdminOrderFinancial }) {
  const bill = financial.order_bill;
  const discount = Number(bill.discount_amount) > 0;

  return (
    <FinancialSection title="Order Bill">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <MoneyRow label="Subtotal" value={formatMoney(bill.subtotal)} />
        <MoneyRow label="Discount" value={formatMoney(bill.discount_amount)} negative={discount} />
        <MoneyRow label="Packaging" value={formatMoney(bill.packaging_fee)} />
        <MoneyRow label="Handling" value={formatMoney(bill.handling_fee)} />
        <MoneyRow label="Platform fee" value={formatMoney(bill.platform_fee)} />
        <MoneyRow label="Delivery" value={formatMoney(bill.delivery_fee)} />
        <MoneyRow label="Tip" value={formatMoney(bill.tip_amount)} />
        <MoneyRow label="Wallet used" value={formatMoney(bill.wallet_used)} />
        <MoneyRow label="Tax (incl.)" value={formatMoney(bill.tax_amount)} />
        {Number(bill.round_off) !== 0 && <MoneyRow label="Round off" value={formatMoney(bill.round_off)} />}
      </div>
      <div className="mt-2 border-t border-neutral-100 pt-2">
        <MoneyRow label="Total" value={formatMoney(bill.total_amount)} strong />
      </div>
    </FinancialSection>
  );
}

function CustomerPayment({ financial }: { financial: AdminOrderFinancial }) {
  return (
    <FinancialSection title="Customer Payment">
      {financial.payments.length > 0 && (
        <div className="space-y-2">
          {financial.payments.map((payment) => (
            <div key={payment.id} className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-neutral-900">{payment.payment_number}</p>
                <span className="flex items-center gap-2">
                  <FinancialStatusPill status={payment.status} />
                  <span className="text-sm font-semibold text-neutral-900">{formatMoney(payment.amount)}</span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500">
                <span className="capitalize">{payment.method ?? '—'}</span>
                {payment.gateway && <span>via {payment.gateway}</span>}
                {payment.provider_reference && <span>ref {payment.provider_reference}</span>}
                {payment.verified_at && <span>verified {formatDateTime(payment.verified_at)}</span>}
              </div>
              {payment.failure_reason && <p className="mt-1 text-xs text-rose-600">{payment.failure_reason}</p>}
              {payment.transaction_statuses && payment.transaction_statuses.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  Gateway flow: {payment.transaction_statuses.map((s) => s.toLowerCase().replace(/_/g, ' ')).join(' → ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {financial.wallet_transactions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Wallet transactions</p>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <THeadRow>
                  <THeadCell>Type</THeadCell>
                  <THeadCell>Amount</THeadCell>
                  <THeadCell>Direction</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell>Description</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {financial.wallet_transactions.map((txn) => (
                  <TRow key={txn.id}>
                    <TCell className="text-xs">{txn.type}</TCell>
                    <TCell className="text-sm font-medium">{formatMoney(txn.amount)}</TCell>
                    <TCell className="text-xs capitalize">{txn.direction}</TCell>
                    <TCell>
                      <FinancialStatusPill status={txn.status} />
                    </TCell>
                    <TCell className="max-w-64 truncate text-xs text-neutral-500">{txn.description ?? '—'}</TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}
    </FinancialSection>
  );
}

function VendorSettlement({ financial }: { financial: AdminOrderFinancial }) {
  const settlement = financial.vendor_settlement;
  if (!settlement) return null;

  return (
    <FinancialSection title="Vendor Settlement">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-900">{settlement.settlement_number}</p>
        <span className="flex items-center gap-2">
          <FinancialStatusPill status={settlement.status} />
          {settlement.payout_status && <FinancialStatusPill status={settlement.payout_status} />}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">
        {settlement.period_type} · {formatDateTime(settlement.period_start)} – {formatDateTime(settlement.period_end)}
      </p>
      <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <MoneyRow label="Gross earnings" value={formatMoney(settlement.gross_earnings)} />
        <MoneyRow label="Commission" value={`−${formatMoney(settlement.total_commission)}`} negative={Number(settlement.total_commission) > 0} />
        <MoneyRow label="Incentives" value={formatMoney(settlement.total_incentives)} />
        <MoneyRow label="Bonuses" value={formatMoney(settlement.total_bonuses)} />
        <MoneyRow label="Adjustments" value={`${Number(settlement.total_adjustments) < 0 ? '−' : ''}${formatMoney(settlement.total_adjustments)}`} />
        <MoneyRow label="Refunds" value={`−${formatMoney(settlement.total_refunds)}`} negative={Number(settlement.total_refunds) > 0} />
      </div>
      <div className="mt-2 border-t border-neutral-100 pt-2">
        <MoneyRow label="Net payable" value={formatMoney(settlement.net_payable)} strong />
        {settlement.paid_at && <p className="mt-1 text-xs text-neutral-500">Paid {formatDateTime(settlement.paid_at)}</p>}
      </div>
      {financial.commissions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Commission record</p>
          <div className="space-y-1.5">
            {financial.commissions.map((commission) => (
              <div key={commission.commission_number} className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-neutral-800">{commission.commission_number}</p>
                  <FinancialStatusPill status={commission.status} />
                </div>
                <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-neutral-600 sm:grid-cols-2">
                  <span>Rate {commission.commission_rate}%</span>
                  <span>Gross {formatMoney(commission.gross_amount)}</span>
                  <span>Commission {formatMoney(commission.commission_amount)}</span>
                  <span>Net {formatMoney(commission.net_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </FinancialSection>
  );
}

function PartnerEarnings({ financial }: { financial: AdminOrderFinancial }) {
  return (
    <FinancialSection title="Delivery Partner Earning">
      <div className="space-y-2">
        {financial.partner_earnings.map((earning) => (
          <div key={earning.earning_number} className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-900">{earning.earning_number}</p>
              <span className="flex items-center gap-2">
                <FinancialStatusPill status={earning.status} />
                {earning.payout_status && <FinancialStatusPill status={earning.payout_status} />}
                <span className="text-sm font-semibold text-neutral-900">{formatMoney(earning.amount)}</span>
              </span>
            </div>
            <div className="mt-2 grid items-start gap-x-4 gap-y-1 sm:grid-cols-2">
              <MoneyRow label="Customer delivery fee" value={formatMoney(earning.customer_delivery_fee)} />
              <MoneyRow label="Admin-funded" value={formatMoney(earning.admin_funded)} strong />
            </div>
            {Number(earning.customer_delivery_fee) === 0 && Number(earning.admin_funded) > 0 && (
              <p className="mt-1.5 text-xs text-amber-700">
                Delivery was free to the customer — the platform funded this earning.
              </p>
            )}
            {earning.paid_at && <p className="mt-1 text-xs text-neutral-500">Paid {formatDateTime(earning.paid_at)}</p>}
          </div>
        ))}
      </div>
    </FinancialSection>
  );
}

function PlatformFinancials({ financial }: { financial: AdminOrderFinancial }) {
  return (
    <FinancialSection title="Platform Financials" defaultOpen={false}>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <MoneyRow label="Platform fee (customer)" value={formatMoney(financial.platform.platform_fee)} />
        <MoneyRow label="Commission (from vendor settlement)" value={formatMoney(financial.platform.commission_fee)} />
        <MoneyRow label="Admin-funded delivery" value={formatMoney(financial.platform.admin_funded_delivery)} />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Numbers are ledger records from this order's settlement and earning rows; no additional platform profit is inferred.
      </p>
    </FinancialSection>
  );
}

function Refunds({ financial }: { financial: AdminOrderFinancial }) {
  return (
    <FinancialSection title="Refunds" defaultOpen={false}>
      <div className="space-y-2">
        {financial.refunds.map((refund) => (
          <div key={refund.refund_number} className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-900">{refund.refund_number}</p>
              <span className="flex items-center gap-2">
                <FinancialStatusPill status={refund.status} />
                <span className="text-sm font-semibold text-rose-600">−{formatMoney(refund.amount)}</span>
              </span>
            </div>
            {refund.reason && <p className="mt-1 text-xs text-neutral-600">{refund.reason}</p>}
            {refund.processed_at ? (
              <p className="mt-0.5 text-xs text-neutral-500">Processed {formatDateTime(refund.processed_at)}</p>
            ) : (
              refund.approved_at && <p className="mt-0.5 text-xs text-neutral-500">Approved {formatDateTime(refund.approved_at)}</p>
            )}
          </div>
        ))}
      </div>
    </FinancialSection>
  );
}