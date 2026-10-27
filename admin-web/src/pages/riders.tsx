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
import { formatDate, formatNumber } from '@/lib/utils';
import type { AdminDriver, PartnerReviewStatus } from '@/typings/models';

const STATUS_FILTERS = [
  ['', 'All statuses'],
  ['pending', 'Pending review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['suspended', 'Suspended'],
  ['online', 'Online'],
  ['offline', 'Offline'],
  ['on_trip', 'On trip'],
] as const;

const BLOCKED = new Set(['pending', 'rejected', 'suspended']);

export function RidersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [rejecting, setRejecting] = useState<AdminDriver | null>(null);
  const [reviewing, setReviewing] = useState<AdminDriver | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-drivers', page, search, status],
    queryFn: () => settingsApi.drivers({ page, search: search || null, status: status || null }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { id: number } & Parameters<typeof settingsApi.updateDriver>[1]) =>
      settingsApi.updateDriver(body.id, body),
    onSuccess: () => {
      toast('Rider updated');
      void qc.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Riders"
        description="Ride-hailing drivers across the app"
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
                  <THeadCell>Rider</THeadCell>
                  <THeadCell>Vehicle</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell>Verified</THeadCell>
                  <THeadCell className="text-right">Rating</THeadCell>
                  <THeadCell className="text-right">Trips</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((r: AdminDriver) => {
                  const statusKey = (r.status ?? (r.is_online ? 'online' : 'offline')).toLowerCase().replace(/\s+/g, '_');
                  const blocked = BLOCKED.has(statusKey);
                  const canVerify = !r.is_verified && statusKey !== 'pending';
                  return (
                    <TRow key={r.id}>
                      <TCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.user?.name ?? 'Rider'} src={null} />
                          <div>
                            <p className="font-semibold text-neutral-900">{r.user?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-400">{r.user?.phone ?? r.license_number ?? `#${r.id}`}</p>
                          </div>
                        </div>
                      </TCell>
                      <TCell>
                        <p className="text-sm">{r.vehicle_number ?? '—'}</p>
                        {(r.vehicle_model || r.vehicle_color) && (
                          <p className="text-xs text-neutral-400">
                            {[r.vehicle_model, r.vehicle_color].filter(Boolean).join(' · ') || ''}
                          </p>
                        )}
                      </TCell>
                      <TCell>
                        <StatusBadge status={statusKey === 'approved' ? 'approved' : statusKey} />
                        {r.rejection_reason && <p className="mt-0.5 max-w-[16rem] text-[10px] text-red-500">{r.rejection_reason}</p>}
                      </TCell>
                      <TCell>
                        <StatusBadge status={r.is_verified ? 'verified' : 'unverified'} />
                        {r.verified_at && <p className="mt-0.5 text-[10px] text-neutral-400">{formatDate(r.verified_at)}</p>}
                      </TCell>
                      <TCell className="text-right">
                        <div>
                          <p className="font-semibold">{r.rating ? Number(r.rating).toFixed(1) : '—'}</p>
                          {typeof r.rating_count === 'number' && <p className="text-[10px] text-neutral-400">({r.rating_count})</p>}
                        </div>
                      </TCell>
                      <TCell className="text-right">{formatNumber(r.total_trips ?? 0)}</TCell>
                      <TCell className="text-right">
                        {blocked ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateMutation.isPending}
                              onClick={() => setReviewing(r)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              disabled={updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateMutation.isPending}
                              onClick={() => setRejecting(r)}
                            >
                              Reject
                            </Button>
                            {statusKey === 'approved' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={updateMutation.isPending}
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: r.id,
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
                              onClick={() => setReviewing(r)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Review
                            </Button>
                            <Select
                              className="h-8 w-28 text-xs"
                              value={statusKey === 'approved' ? 'offline' : statusKey}
                              disabled={updateMutation.isPending}
                              onChange={(e) => updateMutation.mutate({ id: r.id, status: e.target.value as PartnerReviewStatus })}
                            >
                              <option value="online">Online</option>
                              <option value="offline">Offline</option>
                              <option value="on_trip">On trip</option>
                            </Select>
                            {canVerify && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateMutation.isPending}
                                onClick={() => updateMutation.mutate({ id: r.id, is_verified: true })}
                              >
                                Verify
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: r.id,
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
        kind="driver"
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
        subject="rider"
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