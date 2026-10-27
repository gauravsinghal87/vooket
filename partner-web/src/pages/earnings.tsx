import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bike,
  ChevronDown,
  Plus,
  ShieldCheck,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat';
import { ErrorState } from '@/components/ui/state';
import {
  Table,
  THead,
  THeadRow,
  THeadCell,
  TBody,
  TRow,
  TCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { AddMoneyModal } from '@/components/wallet/AddMoneyModal';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatNumber, formatDateTime, formatMoney } from '@/lib/utils';
import type {
  Payout,
  DeliveryEarningEntry,
  DeliveryPartnerEarnings,
  WalletSummary,
  WalletService,
  WalletDirection,
  WalletTransactionEntry,
} from '@/typings/models';
import type { Paginated } from '@/typings/api';

const TABS = ['overview', 'transactions', 'payouts'] as const;
type Tab = (typeof TABS)[number];

const SERVICE_OPTIONS: { value: WalletService | ''; label: string }[] = [
  { value: '', label: 'All services' },
  { value: 'food', label: 'Food' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'ride', label: 'Rides' },
];

const DIRECTION_OPTIONS: { value: WalletDirection | ''; label: string }[] = [
  { value: '', label: 'Both directions' },
  { value: 'credit', label: 'Credits' },
  { value: 'debit', label: 'Debits' },
];

/**
 * Single Partner financial module: earnings summary, wallet ledger and payouts.
 *
 * This replaces the former separate /wallet page. Every figure comes from an
 * existing endpoint — the earnings and wallet APIs, and the payout endpoint that
 * enforces the admin-configured minimum wallet balance — so no financial value is
 * recomputed here. The `*-earnings`, `*-wallet`, `*-wallet-transactions` and
 * `*-payouts` query keys are preserved because other screens invalidate them.
 */
export function EarningsPage() {
  const role = useAuthStore((s) => s.role);
  const api = role === 'delivery_partner' ? partnerApi : driverApi;
  const keyPrefix = role === 'delivery_partner' ? 'partner' : 'driver';
  const isPartner = role === 'delivery_partner';

  // Tab lives in the query string so a tab is linkable and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : 'overview';

  const setTab = (next: Tab) => {
    if (next === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: next }, { replace: true });
    }
  };

  const [txPage, setTxPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [service, setService] = useState<WalletService | ''>('');
  const [direction, setDirection] = useState<WalletDirection | ''>('');
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);

  // Summary figures back the Overview and Payout tabs, so they are always loaded.
  const earningsQ = useQuery({
    queryKey: [`${keyPrefix}-earnings`],
    queryFn: () => api.earnings(),
    refetchOnMount: 'always',
  });

  const walletQ = useQuery({
    queryKey: [`${keyPrefix}-wallet`],
    queryFn: () => api.wallet(),
    refetchOnMount: 'always',
  });

  const txQ = useQuery({
    queryKey: [`${keyPrefix}-wallet-transactions`, service, direction, txPage],
    queryFn: () =>
      api.walletTransactions({
        service: service || undefined,
        direction: direction || undefined,
        page: txPage,
        per_page: 15,
      }),
    enabled: tab === 'transactions',
  });

  const payoutsQ = useQuery({
    queryKey: [`${keyPrefix}-payouts`, payoutPage],
    queryFn: () => api.withdrawals({ page: payoutPage, per_page: 15 }),
    enabled: tab === 'payouts',
  });

  const payout = earningsQ.data?.payout;

  return (
    <PageHeader
      title="Earnings & Wallet"
      description="Your earnings, wallet transactions and payouts"
      actions={
        <div className="flex rounded-xl border border-ink-100 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-brand-600 text-white' : 'text-neutral-600 hover:bg-ink-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'overview' && (
        <OverviewTab
          earnings={earningsQ.data}
          wallet={walletQ.data}
          isLoading={earningsQ.isLoading || walletQ.isLoading}
          isError={earningsQ.isError || walletQ.isError}
          onRetry={() => {
            void earningsQ.refetch();
            void walletQ.refetch();
          }}
          isPartner={isPartner}
          onAddMoney={isPartner ? () => setAddMoneyOpen(true) : undefined}
        />
      )}

      {tab === 'transactions' && (
        <TransactionsTab
          wallet={walletQ.data}
          isLoading={walletQ.isLoading}
          isError={walletQ.isError}
          onRetryWallet={() => void walletQ.refetch()}
          service={service}
          direction={direction}
          onService={(v) => {
            setService(v);
            setTxPage(1);
          }}
          onDirection={(v) => {
            setDirection(v);
            setTxPage(1);
          }}
          onAddMoney={isPartner ? () => setAddMoneyOpen(true) : undefined}
          transactions={txQ.data}
          isLoadingTx={txQ.isLoading}
          isErrorTx={txQ.isError}
          onRetryTx={() => void txQ.refetch()}
          txPage={txPage}
          onTxPage={setTxPage}
        />
      )}

      {tab === 'payouts' && (
        <PayoutsTab
          payout={payout}
          isLoading={earningsQ.isLoading}
          isError={earningsQ.isError}
          onRetry={() => void earningsQ.refetch()}
          payouts={payoutsQ.data}
          isLoadingPayouts={payoutsQ.isLoading}
          isErrorPayouts={payoutsQ.isError}
          onRetryPayouts={() => void payoutsQ.refetch()}
          onPayoutPage={setPayoutPage}
        />
      )}

      <AddMoneyModal
        open={addMoneyOpen}
        onClose={() => setAddMoneyOpen(false)}
        label="Top up your wallet using UPI."
        onCredited={() => {
          // A top-up moves the balance, the ledger and the payout ceiling.
          void walletQ.refetch();
          void earningsQ.refetch();
          void txQ.refetch();
        }}
      />
    </PageHeader>
  );
}

// ---------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------

function OverviewTab({
  earnings,
  wallet,
  isLoading,
  isError,
  onRetry,
  isPartner,
  onAddMoney,
}: {
  earnings?: DeliveryPartnerEarnings;
  wallet?: WalletSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isPartner: boolean;
  onAddMoney?: () => void;
}) {
  if (isError) {
    return (
      <Card className="px-0 py-8">
        <ErrorState onRetry={onRetry} />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const payout = earnings?.payout;

  // One stats section: a single grid holding all six cards. The page container
  // is max-w-6xl, so at xl each card is ~170px wide and the dense variant keeps
  // currency values on one line. Below xl the same grid simply wraps. Every
  // value is read straight from the earnings and wallet endpoints; the
  // withdrawable figure is the backend's wallet-less-minimum calculation and is
  // never derived here.
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          dense
          label="Wallet balance"
          value={formatMoney(wallet?.balance ?? 0)}
          icon={WalletIcon}
          tone="success"
        />
        <StatCard
          dense
          label="Total earned"
          value={formatMoney(wallet?.total_earned ?? 0)}
          icon={Banknote}
          tone="accent"
        />
        <StatCard dense label="Today" value={formatMoney(earnings?.today ?? 0)} icon={TrendingUp} tone="brand" />
        <StatCard
          dense
          label={isPartner ? 'Deliveries' : 'Trips'}
          value={formatNumber(earnings?.total_deliveries ?? earnings?.total_trips ?? 0)}
          icon={Bike}
          tone="accent"
        />
        {payout && (
          <StatCard
            dense
            label="Minimum wallet balance"
            value={formatMoney(payout.minimum_wallet_balance)}
            icon={ShieldCheck}
            tone="violet"
            sub="Must remain after payout"
          />
        )}
        {payout && (
          <StatCard
            dense
            label="Available to withdraw"
            value={formatMoney(payout.available_withdrawable_amount)}
            icon={ArrowDownLeft}
            tone="slate"
          />
        )}
      </div>

      {onAddMoney && (
        <div className="mb-6 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onAddMoney}>
            <Plus className="h-4 w-4" /> Add money
          </Button>
        </div>
      )}

      {isPartner && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">Delivery earnings</h3>
          <Card className="px-0 py-0">
            <EarningsTable earnings={earnings} />
          </Card>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------

function TransactionsTab({
  wallet,
  isLoading,
  isError,
  onRetryWallet,
  service,
  direction,
  onService,
  onDirection,
  onAddMoney,
  transactions,
  isLoadingTx,
  isErrorTx,
  onRetryTx,
  txPage,
  onTxPage,
}: {
  wallet?: WalletSummary;
  isLoading: boolean;
  isError: boolean;
  onRetryWallet: () => void;
  service: WalletService | '';
  direction: WalletDirection | '';
  onService: (v: WalletService | '') => void;
  onDirection: (v: WalletDirection | '') => void;
  onAddMoney?: () => void;
  transactions?: Paginated<WalletTransactionEntry>;
  isLoadingTx: boolean;
  isErrorTx: boolean;
  onRetryTx: () => void;
  txPage: number;
  onTxPage: (p: number) => void;
}) {
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold text-neutral-700">Wallet</h3>
      <p className="-mt-2 mb-3 text-xs text-neutral-500">Your earnings balance and transaction history</p>

      {isError ? (
        <Card className="mb-6 px-0 py-8">
          <ErrorState onRetry={onRetryWallet} />
        </Card>
      ) : isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Available balance" value={formatMoney(wallet?.available_balance ?? 0)} icon={WalletIcon} tone="brand" />
          <StatCard label="Wallet balance" value={formatMoney(wallet?.balance ?? 0)} icon={WalletIcon} tone="success" />
          <StatCard label="Pending transfers" value={formatMoney(wallet?.pending_balance ?? 0)} icon={ArrowUpRight} tone="violet" />
          <StatCard label="Total earned" value={formatMoney(wallet?.total_earned ?? 0)} icon={Banknote} tone="accent" />
          <StatCard label="Total credited" value={formatMoney(wallet?.total_credited ?? 0)} icon={ArrowDownLeft} tone="slate" />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {onAddMoney && (
          <Button size="sm" variant="secondary" onClick={onAddMoney}>
            <Plus className="h-4 w-4" /> Add money
          </Button>
        )}
        <FilterSelect value={service} onChange={(v) => onService(v as WalletService | '')} options={SERVICE_OPTIONS} label="Service" />
        <FilterSelect
          value={direction}
          onChange={(v) => onDirection(v as WalletDirection | '')}
          options={DIRECTION_OPTIONS}
          label="Direction"
        />
      </div>

      <Card className="px-0 py-0">
        {isLoadingTx ? (
          <SkeletonTable />
        ) : isErrorTx ? (
          <ErrorState onRetry={onRetryTx} />
        ) : (
          <TransactionsTable data={transactions!} />
        )}
        {!isLoadingTx && !isErrorTx && transactions && (
          <Pagination page={txPage} lastPage={transactions.last_page} total={transactions.total} onChange={onTxPage} />
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------

function PayoutsTab({
  payout,
  isLoading,
  isError,
  onRetry,
  payouts,
  isLoadingPayouts,
  isErrorPayouts,
  onRetryPayouts,
  onPayoutPage,
}: {
  payout?: DeliveryPartnerEarnings['payout'];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  payouts?: Paginated<Payout>;
  isLoadingPayouts: boolean;
  isErrorPayouts: boolean;
  onRetryPayouts: () => void;
  onPayoutPage: (p: number) => void;
}) {
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold text-neutral-700">Request payout</h3>

      {isError ? (
        <Card className="mb-6 px-0 py-8">
          <ErrorState onRetry={onRetry} />
        </Card>
      ) : isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Wallet balance" value={formatMoney(payout?.wallet_balance ?? 0)} icon={WalletIcon} tone="brand" />
            <StatCard
              label="Minimum wallet balance"
              value={formatMoney(payout?.minimum_wallet_balance ?? 0)}
              icon={ShieldCheck}
              tone="violet"
              sub="Must remain after payout"
            />
            <StatCard
              label="Available to withdraw"
              value={formatMoney(payout?.available_withdrawable_amount ?? 0)}
              icon={ArrowDownLeft}
              tone="slate"
              sub="Maximum payout"
            />
          </div>
          <PayoutForm available={payout?.available_withdrawable_amount ?? 0} minimum={payout?.minimum_wallet_balance ?? 0} />
        </>
      )}

      <h3 className="mb-3 mt-8 text-sm font-semibold text-neutral-700">Payout history</h3>
      <Card className="px-0 py-0">
        {isLoadingPayouts ? (
          <SkeletonTable />
        ) : isErrorPayouts ? (
          <ErrorState onRetry={onRetryPayouts} />
        ) : (
          <WithdrawalsTable data={payouts!} onChange={onPayoutPage} />
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------

function EarningsTable({ earnings }: { earnings?: DeliveryPartnerEarnings }) {
  const list = earnings?.earnings?.data ?? [];
  // A single selection key, not per-row open/closed state. Keyed on the earning
  // id (not order_id) so an earning stays unambiguous if an order ever has more
  // than one earning record.
  const [selectedEarningId, setSelectedEarningId] = useState<number | null>(null);

  // Guard against a stale selection when the list refetches or the role changes.
  const selected = selectedEarningId !== null ? list.find((e) => e.id === selectedEarningId) : undefined;

  const toggle = (id: number) => setSelectedEarningId((current) => (current === id ? null : id));

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <THeadRow>
            <THeadCell>Earning №</THeadCell>
            <THeadCell>Order</THeadCell>
            <THeadCell>Vendor</THeadCell>
            <THeadCell>Delivered to</THeadCell>
            <THeadCell className="text-right">Earning</THeadCell>
            <THeadCell>Status</THeadCell>
            <THeadCell>Delivered</THeadCell>
          </THeadRow>
        </THead>
        <TBody>
          {list.length === 0 && (
            <TRow>
              <TCell colSpan={7} className="text-center text-neutral-400">
                No earnings yet.
              </TCell>
            </TRow>
          )}
          {list.map((e) => {
            const isOpen = selected?.id === e.id;
            return (
              <Fragment key={e.id}>
                <TRow
                  clickable
                  selected={isOpen}
                  onClick={() => toggle(e.id)}
                  aria-expanded={isOpen}
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      toggle(e.id);
                    }
                  }}
                >
                  <TCell className="font-mono text-xs">
                    <span className="flex items-center gap-1.5">
                      <ChevronDown
                        aria-hidden
                        className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                      {e.earning_number}
                    </span>
                  </TCell>
                  <TCell className="font-mono text-xs">{e.order_number ?? '—'}</TCell>
                  <TCell className="text-sm">{e.vendor_name ?? '—'}</TCell>
                  <TCell className="text-sm">{e.delivered_to ?? '—'}</TCell>
                  <TCell className="text-right font-medium">{formatMoney(e.amount)}</TCell>
                  <TCell>
                    <StatusBadge status={e.status} />
                  </TCell>
                  <TCell className="text-sm">{e.delivered_at ? formatDateTime(e.delivered_at) : '—'}</TCell>
                </TRow>
                {isOpen && (
                  <TRow>
                    <TCell colSpan={7} className="bg-ink-50/50 px-4 py-3 whitespace-normal">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-neutral-500">
                        <span className="font-medium uppercase tracking-wide text-neutral-400">Selected earning</span>
                        <span className="font-mono text-neutral-700">{e.order_number ?? e.earning_number}</span>
                        <BreakdownText entry={e} />
                      </div>
                    </TCell>
                  </TRow>
                )}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function BreakdownText({ entry }: { entry: DeliveryEarningEntry }) {
  const b = entry.breakdown;
  if (!b) return <span className="text-neutral-400">Breakdown unavailable</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {typeof b.distance_km === 'number' && <span>{b.distance_km} km</span>}
      {typeof b.customer_delivery_fee === 'number' && b.customer_delivery_fee > 0 && (
        <span>customer fee {formatMoney(b.customer_delivery_fee)}</span>
      )}
      {typeof b.first_distance_earning === 'number' && b.first_distance_earning > 0 && (
        <span>
          free-distance earning {formatMoney(b.first_distance_earning)}
          {typeof b.free_distance_km === 'number' ? ` (first ${b.free_distance_km} km)` : ''}
        </span>
      )}
      {typeof b.additional_admin_earning === 'number' && b.additional_admin_earning > 0 && (
        <span>
          extra-distance earning {formatMoney(b.additional_admin_earning)}
          {typeof b.additional_distance_km === 'number' ? ` (${b.additional_distance_km} km)` : ''}
        </span>
      )}
      {typeof b.per_km === 'number' && <span>₹{b.per_km}/km</span>}
      {typeof b.customer_delivery_fee === 'number' && b.customer_delivery_fee === 0 && (
        <span className="font-medium text-neutral-700">Free delivery · platform funded {formatMoney(entry.amount)}</span>
      )}
      {typeof b.platform_funded === 'number' && b.platform_funded !== entry.amount && (
        <span>platform funded {formatMoney(b.platform_funded)}</span>
      )}
    </span>
  );
}

function TransactionsTable({ data }: { data: Paginated<WalletTransactionEntry> }) {
  const list = data.data;
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <THeadRow>
            <THeadCell>Transaction</THeadCell>
            <THeadCell>Service</THeadCell>
            <THeadCell>Description</THeadCell>
            <THeadCell>Amount</THeadCell>
            <THeadCell>Direction</THeadCell>
            <THeadCell>Date</THeadCell>
          </THeadRow>
        </THead>
        <TBody>
          {list.length === 0 && (
            <TRow>
              <TCell colSpan={6} className="text-center text-neutral-400">
                No wallet transactions yet.
              </TCell>
            </TRow>
          )}
          {list.map((t) => (
            <TRow key={t.transaction_id}>
              <TCell className="font-mono text-xs">{t.type}</TCell>
              <TCell className="text-sm capitalize">{t.service ?? '—'}</TCell>
              <TCell className="text-sm">{t.description ?? '—'}</TCell>
              <TCell className={`text-right font-medium ${t.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {t.direction === 'credit' ? '+' : '−'}
                {formatMoney(t.amount)}
              </TCell>
              <TCell>
                <StatusBadge status={t.direction === 'credit' ? 'credit' : 'debit'} />
              </TCell>
              <TCell className="text-sm">{t.created_at ? formatDateTime(t.created_at) : '—'}</TCell>
            </TRow>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function WithdrawalsTable({ data, onChange }: { data: Paginated<Payout>; onChange: (p: number) => void }) {
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <THeadRow>
              <THeadCell>Payout</THeadCell>
              <THeadCell>Bank</THeadCell>
              <THeadCell className="text-right">Amount</THeadCell>
              <THeadCell>Status</THeadCell>
              <THeadCell>Requested</THeadCell>
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
                  <TCell className="text-sm">
                    {p.bank_name ?? '—'}
                    <p className="text-xs text-neutral-400">{p.bank_ifsc ?? ''}</p>
                  </TCell>
                  <TCell className="text-right font-medium">{formatCurrency(p.amount)}</TCell>
                  <TCell>
                    <StatusBadge status={p.status} />
                  </TCell>
                  <TCell className="text-sm">{formatDateTime(p.created_at)}</TCell>
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
      </div>
      <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={onChange} />
    </>
  );
}

// ---------------------------------------------------------------------
// Payout form
// ---------------------------------------------------------------------

function PayoutForm({ available, minimum }: { available: number; minimum: number }) {
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const api = role === 'delivery_partner' ? partnerApi : driverApi;
  const keyPrefix = role === 'delivery_partner' ? 'partner' : 'driver';
  const [amount, setAmount] = useState('');

  const mutation = useMutation({
    mutationFn: (a: number) => api.requestWithdrawal(a),
    onSuccess: () => {
      toast('Withdrawal requested');
      setAmount('');
      // A new payout changes the ceiling, the ledger and the payout history.
      void qc.invalidateQueries({ queryKey: [`${keyPrefix}-payouts`] });
      void qc.invalidateQueries({ queryKey: [`${keyPrefix}-earnings`] });
      void qc.invalidateQueries({ queryKey: [`${keyPrefix}-wallet`] });
      void qc.invalidateQueries({ queryKey: [`${keyPrefix}-wallet-transactions`] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Request failed', 'error'),
  });

  // Both figures come from the API; nothing here is hard-coded, and the backend
  // revalidates regardless. The rule is on the REMAINING balance, so a small
  // amount is valid as long as the balance stays above the floor.
  const num = Number(amount);
  const nothingAvailable = available <= 0;
  const exceedsMaximum = Boolean(amount) && num > available;

  const message = nothingAvailable
    ? `Minimum wallet balance of ${formatMoney(minimum)} must remain after payout. No payout amount is currently available.`
    : exceedsMaximum
      ? `Maximum payout available is ${formatMoney(available)} because ${formatMoney(minimum)} must remain in your wallet.`
      : null;

  const invalid = nothingAvailable || exceedsMaximum || !num || num <= 0;

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="payout-amount">
            Payout amount (₹)
          </label>
          <Input
            id="payout-amount"
            type="number"
            min={0.01}
            max={available}
            step="1"
            placeholder={available > 0 ? String(available) : '0.00'}
            value={amount}
            disabled={nothingAvailable}
            onChange={(e) => setAmount(e.target.value)}
            className="w-48"
          />
        </div>
        <Button disabled={invalid || mutation.isPending} onClick={() => mutation.mutate(num)}>
          <Banknote className="h-4 w-4" />
          {mutation.isPending ? 'Requesting…' : 'Request payout'}
        </Button>
      </div>
      {message && (
        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
          {message}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-500">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-neutral-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />;
}

function SkeletonTable() {
  return (
    <div className="space-y-3 p-6">
      <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
      <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
      <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
    </div>
  );
}
