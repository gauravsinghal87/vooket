import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react';
import { payoutsApi } from '@/repositories/admin';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCompactCurrency, formatCurrency, formatDateTime, timeFromNow } from '@/lib/utils';
import type { AdminPayout } from '@/typings/models';

const statusOptions = ['', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'];
const MAX_REMARK_LENGTH = 1000;

function partyName(p: AdminPayout): string {
  return p.party_type === 'vendor'
    ? p.vendor?.business_name ?? 'Vendor'
    : p.party_type === 'driver'
      ? p.driver?.user?.name ?? 'Driver'
      : p.delivery_partner?.user?.name ?? 'Partner';
}

function partyLabel(p: AdminPayout): string {
  return String(p.party_type).replace(/_/g, ' ');
}

function bankLabel(p: AdminPayout): string {
  const bank = [p.bank_name, p.bank_ifsc].filter(Boolean).join(' · ');
  return bank || '—';
}

export function PayoutsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [paidTarget, setPaidTarget] = useState<AdminPayout | null>(null);
  const [remark, setRemark] = useState('');
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-payouts', page, status, search],
    queryFn: () => payoutsApi.list({ page, per_page: 20, status: status || null, search: search || null }),
  });

  const detailsQ = useQuery({
    queryKey: ['admin-payout', detailsId],
    queryFn: () => payoutsApi.get(detailsId as number),
    enabled: detailsId !== null,
  });

  const payouts = data?.data ?? [];
  const meta = data?.meta;

  const transition = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: 'processing' | 'paid' | 'failed'; reason?: string }) => {
      switch (action) {
        case 'processing':
          return payoutsApi.processing(id);
        case 'paid':
          return payoutsApi.paid(id);
        case 'failed':
        default:
          return payoutsApi.failed(id, reason);
      }
    },
    onSuccess: (_d, vars) => {
      toast(`Payout ${vars.action === 'processing' ? 'moved to processing' : vars.action === 'paid' ? 'marked as paid' : 'marked as failed'}`);
      void qc.invalidateQueries({ queryKey: ['admin-payouts'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Action failed', 'error'),
  });

  const paidMutation = useMutation({
    mutationFn: ({ id, adminRemark }: { id: number; adminRemark?: string }) => payoutsApi.paid(id, adminRemark),
    onSuccess: (payout) => {
      toast('Payout marked as paid');
      setPaidTarget(null);
      setRemark('');
      setRemarkError(null);
      void qc.invalidateQueries({ queryKey: ['admin-payouts'] });
      void qc.invalidateQueries({ queryKey: ['admin-payout', payout.id] });
    },
    onError: (err) => {
      setRemarkError(
        err instanceof ApiError && err.errors?.admin_remark?.length
          ? err.errors.admin_remark[0]
          : err instanceof Error
            ? err.message
            : 'Could not mark the payout as paid'
      );
    },
  });

  const openPaidModal = (p: AdminPayout) => {
    setPaidTarget(p);
    setRemark(p.admin_remark ?? '');
    setRemarkError(null);
  };

  const closePaidModal = () => {
    if (paidMutation.isPending) return;
    setPaidTarget(null);
    setRemark('');
    setRemarkError(null);
  };

  const confirmPaid = () => {
    if (!paidTarget || paidMutation.isPending) return;

    const trimmed = remark.trim();

    if (trimmed.length > MAX_REMARK_LENGTH) {
      setRemarkError(`Admin remark cannot exceed ${MAX_REMARK_LENGTH} characters.`);
      return;
    }

    setRemarkError(null);
    paidMutation.mutate({ id: paidTarget.id, adminRemark: trimmed || undefined });
  };

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Vendor, driver and delivery-partner settlement payouts"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Input
            placeholder="Search payouts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(query.trim());
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Card>
          <Table>
            <THead>
              <THeadRow>
                <THeadCell>Payout</THeadCell>
                <THeadCell>Party</THeadCell>
                <THeadCell>Amount</THeadCell>
                <THeadCell>Status</THeadCell>
                <THeadCell>Requested</THeadCell>
                <THeadCell className="text-right">Actions</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {payouts.map((p: AdminPayout) => (
                <TRow key={p.id}>
                  <TCell>
                    <p className="font-medium">#{p.payout_number}</p>
                    <p className="text-xs text-neutral-400">ID {p.id}</p>
                    {p.status === 'SUCCESS' && p.admin_remark && (
                      <p className="mt-2 max-w-xs whitespace-pre-wrap break-words rounded-lg bg-ink-50 px-2 py-1 text-xs text-neutral-600">
                        <span className="font-semibold text-neutral-700">Admin remark: </span>
                        {p.admin_remark}
                      </p>
                    )}
                  </TCell>
                  <TCell>
                    <p className="capitalize text-sm">{partyName(p)}</p>
                    <p className="text-xs capitalize text-neutral-400">{partyLabel(p)}</p>
                  </TCell>
                  <TCell className="font-medium">{formatCompactCurrency(Number(p.amount))}</TCell>
                  <TCell>
                    <StatusBadge status={p.status} />
                  </TCell>
                  <TCell>
                    <p className="text-sm">{formatDateTime(p.created_at)}</p>
                    <p className="text-xs text-neutral-400">{timeFromNow(p.created_at)}</p>
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetailsId(p.id)}>
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                      {p.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={transition.isPending && transition.variables?.id === p.id}
                          onClick={() => transition.mutate({ id: p.id, action: 'processing' })}
                        >
                          <Loader2 className="h-3.5 w-3.5" /> Process
                        </Button>
                      )}
                      {(p.status === 'PENDING' || p.status === 'PROCESSING') && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            loading={paidMutation.isPending && paidMutation.variables?.id === p.id}
                            onClick={() => openPaidModal(p)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark paid
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={transition.isPending && transition.variables?.id === p.id}
                            onClick={() => {
                              const reason = window.prompt('Failure reason', '') ?? undefined;
                              transition.mutate({ id: p.id, action: 'failed', reason });
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Mark failed
                          </Button>
                        </>
                      )}
                    </div>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>

          <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
            <p className="text-sm text-neutral-500">
              {meta?.total ?? 0} payout{meta?.total === 1 ? '' : 's'}
            </p>
            {meta && <Pagination page={meta.page ?? 1} lastPage={meta.last_page ?? 1} total={meta.total ?? 0} onChange={setPage} />}
          </div>
        </Card>
      )}

      <Modal
        open={paidTarget !== null}
        onOpenChange={(open) => !open && closePaidModal()}
        title="Confirm payout payment"
        description="Record the manual payment against this payout. No bank transfer is initiated."
      >
        {paidTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Payout reference</dt>
                  <dd className="mt-0.5 font-mono text-xs font-semibold text-neutral-900">{paidTarget.payout_number}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Recipient</dt>
                  <dd className="mt-0.5 font-medium text-neutral-900">{partyName(paidTarget)}</dd>
                  <dd className="text-xs capitalize text-neutral-500">{partyLabel(paidTarget)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
                  <dd className="mt-0.5 text-base font-bold text-neutral-900">{formatCurrency(Number(paidTarget.amount))}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Bank</dt>
                  <dd className="mt-0.5 text-neutral-800">{bankLabel(paidTarget)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <label htmlFor="admin-remark" className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-700">
                <span>
                  Admin remark <span className="font-normal text-neutral-400">(optional)</span>
                </span>
                <span className="text-xs font-normal text-neutral-400">
                  {remark.length}/{MAX_REMARK_LENGTH}
                </span>
              </label>
              <Textarea
                id="admin-remark"
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                  if (remarkError) setRemarkError(null);
                }}
                rows={4}
                maxLength={MAX_REMARK_LENGTH}
                disabled={paidMutation.isPending}
                placeholder="e.g. Paid via SBI bank transfer on 23 October 2026. Reference: TXN123456."
              />
              <p className="mt-1.5 text-xs text-neutral-400">
                This note is shown to the recipient in their payout history.
              </p>
              {remarkError && (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {remarkError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" disabled={paidMutation.isPending} onClick={closePaidModal}>
                Cancel
              </Button>
              <Button variant="success" size="sm" loading={paidMutation.isPending} onClick={confirmPaid}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={detailsId !== null}
        onOpenChange={(open) => !open && setDetailsId(null)}
        title="Payout details"
        description={detailsQ.data ? detailsQ.data.payout_number : undefined}
        wide
      >
        {detailsQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : detailsQ.isError ? (
          <ErrorState onRetry={() => void detailsQ.refetch()} />
        ) : detailsQ.data ? (
          <div className="space-y-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Recipient</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{partyName(detailsQ.data)}</dd>
                <dd className="text-xs capitalize text-neutral-500">{partyLabel(detailsQ.data)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Amount</dt>
                <dd className="mt-0.5 text-base font-bold text-neutral-900">{formatCurrency(Number(detailsQ.data.amount))}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Status</dt>
                <dd className="mt-0.5">
                  <StatusBadge status={detailsQ.data.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Requested</dt>
                <dd className="mt-0.5 text-neutral-800">{formatDateTime(detailsQ.data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Processed</dt>
                <dd className="mt-0.5 text-neutral-800">{detailsQ.data.processed_at ? formatDateTime(detailsQ.data.processed_at) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Bank</dt>
                <dd className="mt-0.5 text-neutral-800">{bankLabel(detailsQ.data)}</dd>
                <dd className="text-xs text-neutral-500">
                  {detailsQ.data.bank_account_name ?? '—'}
                  {detailsQ.data.bank_account_number ? ` · ${detailsQ.data.bank_account_number}` : ''}
                </dd>
              </div>
              {detailsQ.data.failure_reason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Failure reason</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-neutral-800">{detailsQ.data.failure_reason}</dd>
                </div>
              )}
            </dl>

            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Admin remark</p>
              {detailsQ.data.status === 'SUCCESS' && detailsQ.data.admin_remark ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800">{detailsQ.data.admin_remark}</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-500">No admin remark recorded.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
