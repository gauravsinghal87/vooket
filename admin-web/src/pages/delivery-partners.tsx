import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye } from 'lucide-react';
import { settingsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { RejectModal } from '@/components/review/reject-modal';
import { ReviewModal } from '@/components/review/review-modal';
import { toast } from '@/components/ui/toast';
import { formatNumber } from '@/lib/utils';
import type { AdminDeliveryPartner, PartnerReviewStatus } from '@/typings/models';

const STATUS_FILTERS = [
  ['', 'All statuses'],
  ['pending', 'Pending review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['suspended', 'Suspended'],
  ['online', 'Online'],
  ['offline', 'Offline'],
  ['on_delivery', 'On delivery'],
] as const;

const SERVICE_FILTERS = [
  ['', 'All services'],
  ['food', 'Food delivery'],
  ['grocery', 'Grocery delivery'],
] as const;

const SERVICE_LABEL: Record<string, string> = { food: 'Food', grocery: 'Grocery' };

const BLOCKED = new Set(['pending', 'rejected', 'suspended']);

export function DeliveryPartnersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [rejecting, setRejecting] = useState<AdminDeliveryPartner | null>(null);
  const [reviewing, setReviewing] = useState<AdminDeliveryPartner | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-delivery-partners', page, search, status, service],
    queryFn: () =>
      settingsApi.deliveryPartners({ page, search: search || null, status: status || null, service_type: (service as 'food' | 'grocery') || null }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { id: number } & Parameters<typeof settingsApi.updateDeliveryPartner>[1]) =>
      settingsApi.updateDeliveryPartner(body.id, body),
    onSuccess: () => {
      toast('Delivery partner updated');
      void qc.invalidateQueries({ queryKey: ['admin-delivery-partners'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Delivery partners"
        description="Separate pools for food delivery and grocery delivery"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by name, phone or vehicle…"
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
        <Select
          className="w-44"
          value={service}
          onChange={(e) => {
            setService(e.target.value);
            setPage(1);
          }}
        >
          {SERVICE_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {STATUS_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
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
                  <THeadCell>Partner</THeadCell>
                  <THeadCell>Vehicle</THeadCell>
                  <THeadCell>Service</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell className="text-right">Rating</THeadCell>
                  <THeadCell className="text-right">Deliveries</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((p: AdminDeliveryPartner) => {
                  const blocked = BLOCKED.has(p.status.toLowerCase().replace(/\s+/g, '_'));
                  return (
                    <TRow key={p.id}>
                      <TCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={p.user?.name ?? 'Partner'} src={null} />
                          <div>
                            <p className="font-semibold text-neutral-900">{p.user?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-400">{p.user?.phone ?? p.license_number ?? `#${p.id}`}</p>
                          </div>
                        </div>
                      </TCell>
                      <TCell>
                        <p className="text-sm capitalize">{p.vehicle_type ?? '—'}</p>
                        <p className="text-xs text-neutral-400">{p.vehicle_number ?? ''}</p>
                        {(p.vehicle_model || p.vehicle_color) && (
                          <p className="text-xs text-neutral-400">
                            {[p.vehicle_model, p.vehicle_color].filter(Boolean).join(' · ') || ''}
                          </p>
                        )}
                      </TCell>
                      <TCell>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            p.service_type === 'grocery' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {SERVICE_LABEL[p.service_type ?? 'food'] ?? p.service_type}
                        </span>
                      </TCell>
                      <TCell>
                        <StatusBadge status={p.status} />
                        {p.rejection_reason && <p className="mt-0.5 max-w-[16rem] text-[10px] text-red-500">{p.rejection_reason}</p>}
                      </TCell>
                      <TCell className="text-right">
                        <div>
                          <p className="font-semibold">{p.rating ? Number(p.rating).toFixed(1) : '—'}</p>
                          {typeof p.rating_count === 'number' && <p className="text-[10px] text-neutral-400">({p.rating_count})</p>}
                        </div>
                      </TCell>
                      <TCell className="text-right">{formatNumber(p.total_deliveries ?? 0)}</TCell>
                      <TCell className="text-right">
                        {blocked ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateMutation.isPending}
                              onClick={() => setReviewing(p)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              disabled={updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: p.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateMutation.isPending}
                              onClick={() => setRejecting(p)}
                            >
                              Reject
                            </Button>
                            {p.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={updateMutation.isPending}
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: p.id,
                                    status: 'suspended',
                                    rejection_reason: 'Account suspended by admin',
                                  })
                                }
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateMutation.isPending}
                              onClick={() => setReviewing(p)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </Button>
                            <Select
                              className="h-8 w-28 text-xs"
                              value={p.status === 'approved' ? 'offline' : p.status.toLowerCase().replace(/\s+/g, '_')}
                              disabled={updateMutation.isPending}
                              onChange={(e) =>
                                updateMutation.mutate({ id: p.id, status: e.target.value as PartnerReviewStatus })
                              }
                            >
                              <option value="online">Online</option>
                              <option value="offline">Offline</option>
                              <option value="on_delivery">On delivery</option>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: p.id,
                                  status: 'suspended',
                                  rejection_reason: 'Account suspended by admin',
                                })
                              }
                            >
                              Suspend
                            </Button>
                          </div>
                        )}
                      </TCell>
                    </TRow>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <ReviewModal
        open={!!reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing(null);
        }}
        kind="delivery_partner"
        id={reviewing?.id ?? 0}
        busy={updateMutation.isPending}
        onApprove={() => reviewing && updateMutation.mutate({ id: reviewing.id, status: 'approved' })}
        onReject={(reason) =>
          reviewing && updateMutation.mutate({ id: reviewing.id, status: 'rejected', rejection_reason: reason })
        }
        onSuspend={() =>
          reviewing &&
          updateMutation.mutate({ id: reviewing.id, status: 'suspended', rejection_reason: 'Account suspended by admin' })
        }
      />

      <RejectModal
        open={!!rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        subject="delivery partner"
        busy={updateMutation.isPending}
        onSubmit={(reason) =>
          updateMutation.mutate(
            { id: rejecting?.id as number, status: 'rejected', rejection_reason: reason },
            { onSuccess: () => setRejecting(null) }
          )
        }
      />
    </>
  );
}