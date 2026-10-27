import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Banknote, ArrowDownToLine, Clock4, ShieldCheck } from 'lucide-react';
import { earningsApi } from '@/repositories/vendor';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Paginated } from '@/typings/api';
import type { Payout, Settlement } from '@/typings/models';

const tabs = ['overview', 'settlements', 'payouts'] as const;
type Tab = (typeof tabs)[number];

export function EarningsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [settlePage, setSettlePage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);

  const settlementsQ = useQuery({
    queryKey: ['vendor-settlements', settlePage],
    queryFn: () => earningsApi.settlements({ page: settlePage, per_page: 15 }),
    enabled: tab === 'settlements',
  });

  const payoutsQ = useQuery({
    queryKey: ['vendor-payouts', payoutPage],
    queryFn: () => earningsApi.payouts({ page: payoutPage, per_page: 15 }),
    enabled: tab === 'payouts',
  });

  return (
    <PageHeader
      title="Earnings"
      description="Wallet, settlements and payouts"
      actions={
        <div className="flex rounded-xl border border-ink-100 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-brand-600 text-white' : 'text-neutral-600 hover:bg-ink-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'overview' && <Overview />}
      {tab === 'settlements' &&
        (settlementsQ.isLoading ? (
          <Skeleton className="py-10" />
        ) : settlementsQ.isError ? (
          <ErrorState onRetry={() => void settlementsQ.refetch()} />
        ) : (
          <SettlementTable data={settlementsQ.data!} onChange={setSettlePage} />
        ))}
      {tab === 'payouts' &&
        (payoutsQ.isLoading ? (
          <Skeleton className="py-10" />
        ) : payoutsQ.isError ? (
          <ErrorState onRetry={() => void payoutsQ.refetch()} />
        ) : (
          <PayoutTable data={payoutsQ.data!} onChange={setPayoutPage} />
        ))}
    </PageHeader>
  );
}

function Overview() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-earnings-overview'],
    queryFn: () => earningsApi.overview(),
  });

  const requestMutation = useMutation({
    mutationFn: (a: number) => earningsApi.requestPayout(a),
    onSuccess: () => {
      toast('Payout requested');
      setAmount('');
      setAmountError(null);
      void qc.invalidateQueries({ queryKey: ['vendor-earnings-overview'] });
      void qc.invalidateQueries({ queryKey: ['vendor-payouts'] });
    },
    onError: (err) => {
      // The backend owns this rule, so a rejection here is authoritative — show
      // it against the field rather than only as a toast.
      if (err instanceof ApiError && err.errors?.amount?.length) {
        setAmountError(err.errors.amount[0]);
        return;
      }
      setAmountError(err instanceof Error ? err.message : 'Request failed');
    },
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  // Every figure comes from the API. The configured floor is never hard-coded,
  // so an admin change applies on the next load without a redeploy.
  const minimumBalance = data.minimum_wallet_balance ?? 0;
  const maximum = data.max_withdrawable_amount ?? 0;
  const amountNum = Number(amount);

  const balanceTooLow = maximum <= 0;
  const exceedsMaximum = Boolean(amount) && amountNum > maximum;

  const validationMessage = balanceTooLow
    ? `Wallet balance must be more than ₹${minimumBalance.toLocaleString('en-IN')} to request a payout.`
    : exceedsMaximum
      ? `Maximum payout amount is ₹${maximum.toLocaleString('en-IN')}.`
      : null;

  const invalid = balanceTooLow || exceedsMaximum || !amountNum || amountNum <= 0;

  const updateAmount = (value: string) => {
    setAmount(value);
    setAmountError(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Wallet balance" value={formatCurrency(data.wallet?.balance ?? 0)} icon={Wallet} tone="brand" sub={data.wallet?.currency ?? 'INR'} />
        <StatCard label="Minimum wallet balance" value={formatCurrency(minimumBalance)} icon={ShieldCheck} tone="violet" sub="Must remain after payout" />
        <StatCard label="Available to withdraw" value={formatCurrency(maximum)} icon={Clock4} tone="accent" sub="Maximum payout" />
        <StatCard label="Total settled" value={formatCurrency(data.total_settled)} icon={Banknote} tone="success" />
        <StatCard label="Pending payouts" value={formatCurrency(data.pending_payouts)} icon={ArrowDownToLine} tone="violet" />
      </div>

      <Card>
        <h2 className="font-bold text-neutral-900">Request payout</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Paid into your registered bank account ({data.vendor.vendor_type === 'grocery' ? 'grocery' : 'restaurant'} · {data.vendor.commission_rate}% commission)
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Wallet balance {formatCurrency(data.wallet?.balance ?? 0)} · Minimum wallet balance {formatCurrency(minimumBalance)} · Maximum payout{' '}
          {formatCurrency(maximum)}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Amount (₹)</label>
            <Input
              type="number"
              min={0}
              max={maximum}
              step="0.01"
              placeholder={maximum > 0 ? String(maximum) : '0.00'}
              value={amount}
              onChange={(e) => updateAmount(e.target.value)}
              aria-invalid={Boolean(validationMessage ?? amountError)}
              className="w-48"
            />
          </div>
          <Button
            disabled={invalid || Boolean(amountError) || requestMutation.isPending}
            onClick={() => {
              setAmountError(null);
              requestMutation.mutate(amountNum);
            }}
          >
            {requestMutation.isPending ? 'Requesting…' : 'Request payout'}
          </Button>
        </div>
        {(amountError ?? validationMessage) && (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {amountError ?? validationMessage}
          </p>
        )}
      </Card>
    </div>
  );
}

function SettlementTable({ data, onChange }: { data: Paginated<Settlement>; onChange: (p: number) => void }) {
  return (
    <Card className="px-0 py-0">
      <Table>
        <THead>
          <THeadRow>
            <THeadCell>Period</THeadCell>
            <THeadCell>Settlement</THeadCell>
            <THeadCell className="text-right">Gross</THeadCell>
            <THeadCell className="text-right">Commission</THeadCell>
            <THeadCell className="text-right">Net payable</THeadCell>
            <THeadCell>Status</THeadCell>
          </THeadRow>
        </THead>
        <TBody>
          {data.data.length === 0 && (
            <TRow>
              <TCell colSpan={6} className="text-center text-neutral-400">
                No settlements yet.
              </TCell>
            </TRow>
          )}
          {data.data.map((s) => (
            <TRow key={s.id}>
              <TCell>
                <p className="text-sm font-medium text-neutral-900">{formatDate(s.period_start)} → {formatDate(s.period_end)}</p>
                <p className="text-xs text-neutral-400 capitalize">{s.period_type}</p>
              </TCell>
              <TCell className="font-mono text-xs">{s.settlement_number}</TCell>
              <TCell className="text-right">{formatCurrency(s.gross_earnings)}</TCell>
              <TCell className="text-right text-red-600">−{formatCurrency(s.total_commission)}</TCell>
              <TCell className="text-right font-semibold">{formatCurrency(s.net_payable)}</TCell>
              <TCell>
                <StatusBadge status={s.status} />
              </TCell>
            </TRow>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={onChange} />
    </Card>
  );
}

function PayoutTable({ data, onChange }: { data: Paginated<Payout>; onChange: (p: number) => void }) {
  return (
    <Card className="px-0 py-0">
      <Table>
        <THead>
          <THeadRow>
            <THeadCell>Payout</THeadCell>
            <THeadCell>Date</THeadCell>
            <THeadCell>Bank</THeadCell>
            <THeadCell className="text-right">Amount</THeadCell>
            <THeadCell>Status</THeadCell>
          </THeadRow>
        </THead>
        <TBody>
          {data.data.length === 0 && (
            <TRow>
              <TCell colSpan={5} className="text-center text-neutral-400">
                No payouts yet.
              </TCell>
            </TRow>
          )}
          {data.data.map((p) => (
            <Fragment key={p.id}>
              <TRow>
                <TCell className="font-mono text-xs">{p.payout_number}</TCell>
                <TCell className="text-sm">{formatDate(p.created_at)}</TCell>
                <TCell className="text-sm">
                  {p.bank_name ?? '—'}
                  <p className="text-xs text-neutral-400">{p.bank_ifsc ?? ''}</p>
                </TCell>
                <TCell className="text-right font-medium">{formatCurrency(p.amount)}</TCell>
                <TCell>
                  <StatusBadge status={p.status} />
                </TCell>
              </TRow>
              {p.status === 'SUCCESS' && p.admin_remark && (
                <TRow>
                  <TCell colSpan={5} className="bg-ink-50/50">
                    <p className="whitespace-pre-wrap break-words text-xs text-neutral-600">
                      <span className="font-semibold text-neutral-700">Admin remark: </span>
                      {p.admin_remark}
                    </p>
                  </TCell>
                </TRow>
              )}
            </Fragment>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={onChange} />
    </Card>
  );
}