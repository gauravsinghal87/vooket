import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Eye, LogIn } from 'lucide-react';
import { vendorsApi, settingsApi } from '@/repositories/admin';
import type { AdminVendor } from '@/typings/models';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { VendorReviewModal } from '@/components/review/vendor-review-modal';
import { ImpersonateVendorModal } from '@/components/review/impersonate-vendor-modal';
import { toast } from '@/components/ui/toast';
import { formatCompactCurrency, formatDateTime, timeFromNow } from '@/lib/utils';

const typeLabel: Record<string, string> = { restaurant: 'Restaurant', grocery: 'Grocery store' };

export function VendorsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<AdminVendor | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-vendors', page, search, status],
    queryFn: () => vendorsApi.list({ page, search: search || null, status: status || null }),
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['admin-app-settings-commission'],
    queryFn: () => settingsApi.list('commission'),
  });
  const foodCommissionSetting = commissionSettings?.data?.find((s) => s.key === 'food_commission');
  const foodCommissionDefault =
    foodCommissionSetting?.value !== undefined && foodCommissionSetting?.value !== null
      ? Number(foodCommissionSetting.value)
      : null;

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      commissionRate,
    }: {
      id: number;
      action: 'approve' | 'reject' | 'suspend' | 'reactivate';
      reason?: string;
      commissionRate?: number;
    }) => {
      const body: {
        action: typeof action;
        rejection_reason?: string;
        suspension_reason?: string;
        commission_rate?: number;
      } = { action };
      if (action === 'reject') body.rejection_reason = reason ?? window.prompt('Rejection reason', 'Documents incomplete') ?? undefined;
      if (action === 'suspend') body.suspension_reason = window.prompt('Suspension reason', 'Policy violation') ?? undefined;
      if (commissionRate !== undefined) body.commission_rate = commissionRate;
      return vendorsApi.review(id, body);
    },
    onSuccess: (_d, vars) => {
      toast(`Partner ${vars.action}d`);
      setReviewId(null);
      void qc.invalidateQueries({ queryKey: ['admin-vendors'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Action failed', 'error'),
  });

  /**
   * Start a vendor impersonation session.
   *
   * The vendor panel opens in a NEW tab. The admin tab keeps its own session
   * untouched, so the administrator simply closes the vendor tab - or uses the
   * in-app "Exit vendor login" - and lands back on an authenticated Admin
   * panel. The URL is built by the backend, so the target origin is never
   * client-controlled.
   */
  const impersonateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => vendorsApi.impersonate(id, reason),
    onSuccess: (res) => {
      setImpersonateTarget(null);
      const win = window.open(res.handoff_url, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Popup blocked: still tell the user where to go rather than failing silently.
        toast('Allow pop-ups to open the vendor panel, or use the link below.', 'error');
        return;
      }
      toast(`Opened vendor panel as ${res.vendor.business_name}`);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not start vendor session', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Delivery Partners"
        description="Driver onboarding, approvals and performance"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search partners…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="w-64 pl-9"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
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
                  <THeadCell>Partner</THeadCell>
                  <THeadCell>Type</THeadCell>
                  <THeadCell>Owner</THeadCell>
                  <THeadCell>Outlet count</THeadCell>
                  <THeadCell>Orders</THeadCell>
                  <THeadCell>Gross sales</THeadCell>
                  <THeadCell>Commission</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell>Joined</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((v) => (
                  <TRow key={v.id}>
                    <TCell>
                      <div className="flex items-center gap-3">
                        {v.logo ? <img src={v.logo} alt={v.business_name} className="h-9 w-9 rounded-lg object-cover" /> : <Avatar name={v.business_name} />}
                        <div>
                          <p className="font-semibold text-neutral-900">{v.business_name}</p>
                          <p className="text-xs text-neutral-400">#{v.id} · {v.commission_rate}% commission</p>
                        </div>
                      </div>
                    </TCell>
                    <TCell className="capitalize">{typeLabel[v.vendor_type] ?? v.vendor_type}</TCell>
                    <TCell>
                      <p className="text-sm">{v.owner_name ?? '—'}</p>
                      <p className="text-xs text-neutral-400">{v.phone ?? v.user?.phone}</p>
                    </TCell>
                    <TCell>{(v.restaurants_count ?? 0) + (v.stores_count ?? 0)}</TCell>
                    <TCell>{v.orders_count ?? 0}</TCell>
                    <TCell className="font-medium">{v.gross_order_value ? formatCompactCurrency(v.gross_order_value) : '—'}</TCell>
                    <TCell className="font-medium">{v.commission ? formatCompactCurrency(v.commission) : '—'}</TCell>
                    <TCell>
                      <StatusBadge status={v.status} />
                    </TCell>
                    <TCell>
                      <p className="text-sm">{formatDateTime(v.created_at)}</p>
                      <p className="text-xs text-neutral-400">{timeFromNow(v.created_at)}</p>
                    </TCell>
                    <TCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setReviewId(v.id)}>
                          <Eye className="h-3.5 w-3.5" /> Review
                        </Button>
                        {v.status === 'pending' && (
                          <>
                            <Button size="sm" variant="success" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: v.id, action: 'approve', commissionRate: v.vendor_type === 'restaurant' ? (foodCommissionDefault ?? v.commission_rate) : undefined })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: v.id, action: 'reject' })}>
                              Reject
                            </Button>
                          </>
                        )}
                        {v.status === 'approved' && (
                          <>
                            <Button size="sm" variant="danger" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: v.id, action: 'suspend' })}>
                              Suspend
                            </Button>
                          </>
                        )}
                        {v.status === 'suspended' && (
                          <Button size="sm" variant="success" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: v.id, action: 'reactivate' })}>
                            Reactivate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={impersonateMutation.isPending}
                          title={`Open the vendor panel as ${v.business_name}`}
                          onClick={() => setImpersonateTarget(v)}
                        >
                          <LogIn className="h-3.5 w-3.5" /> Login as Vendor
                        </Button>
                      </div>
                    </TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <VendorReviewModal
        open={reviewId !== null}
        onOpenChange={(open) => {
          if (!open) setReviewId(null);
        }}
        id={reviewId ?? 0}
        busy={reviewMutation.isPending}
        onApprove={(commissionRate) => reviewId !== null && reviewMutation.mutate({ id: reviewId, action: 'approve', commissionRate })}
        onReject={(reason) => reviewId !== null && reviewMutation.mutate({ id: reviewId, action: 'reject', reason })}
        onSuspend={() => reviewId !== null && reviewMutation.mutate({ id: reviewId, action: 'suspend' })}
      />

      <ImpersonateVendorModal
        open={impersonateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setImpersonateTarget(null);
        }}
        vendorId={impersonateTarget?.id ?? null}
        businessName={impersonateTarget?.business_name ?? ''}
        vendorType={impersonateTarget?.vendor_type ?? ''}
        vendorStatus={impersonateTarget?.status ?? ''}
        busy={impersonateMutation.isPending}
        onSubmit={(reason) =>
          impersonateTarget && impersonateMutation.mutate({ id: impersonateTarget.id, reason })
        }
      />
    </>
  );
}