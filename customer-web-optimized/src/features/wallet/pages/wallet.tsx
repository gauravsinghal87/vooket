import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, Plus, Loader2, ChevronRight, Info } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { Card } from '@/shared/components/ui/card';
import { Price } from '@/shared/components/ui/price';
import { Button } from '@/shared/components/ui/button';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/components/ui/state';
import { toast } from '@/shared/components/ui/toast';
import { cn } from '@/shared/utils/utils';
import type { WalletTransaction } from '@/shared/types/catalog';

const TOPUPS = [100, 500, 1000];

export function WalletPage() {
  const queryClient = useQueryClient();
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState<number>(500);
  const [txDetail, setTxDetail] = useState<WalletTransaction | null>(null);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => repositories.wallet.getWallet() });
  const transactions = useQuery({ queryKey: ['wallet-transactions'], queryFn: () => repositories.wallet.getTransactions() });

  const topup = useMutation({
    mutationFn: (amt: number) => repositories.wallet.topup(amt),
    onSuccess: () => {
      toast(`₹${amount} added to wallet`);
      setTopupOpen(false);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
    onError: () => toast('Could not add money', 'error'),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900">Wallet</h1>
          <p className="text-sm text-neutral-500">Payments, refunds & top-ups.</p>
        </div>
      </div>

      {wallet.isLoading && <Skeleton className="h-40 w-full rounded-3xl" />}

      {wallet.isError && (
        <ErrorState title="Couldn't load wallet" action={{ label: 'Retry', onClick: () => wallet.refetch() }} />
      )}

      {wallet.data && (
        <section className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
          <div className="flex items-center gap-2 text-white/80">
            <WalletIcon className="h-4 w-4" />
            <span className="text-sm">Available balance</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold">
            <Price value={wallet.data.balance} />
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setTopupOpen(true)} className="bg-white text-brand-700 hover:bg-brand-50">
              <Plus className="h-4 w-4" /> Add money
            </Button>
            <Link to="/checkout" className="rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/30">
              Pay with wallet
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/70">
            Pending balance: <Price value={wallet.data.pending_balance} size="sm" />
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold text-neutral-900">Transactions</h2>
        {transactions.isLoading && <Skeleton className="h-32 w-full rounded-2xl" />}
        {transactions.isError && <ErrorState title="Couldn't load transactions" />}
        {transactions.data && transactions.data.length === 0 && (
          <EmptyState
            icon={WalletIcon}
            title="No transactions yet"
            description="Top up your wallet to get started."
            action={{ label: 'Add money', onClick: () => setTopupOpen(true) }}
          />
        )}
        {transactions.data && transactions.data.length > 0 && (
          <div className="space-y-2">
            {transactions.data.map((t) => (
              <button
                key={t.id}
                onClick={() => setTxDetail(t)}
                className="w-full text-left"
              >
                <Card className="flex items-center gap-3 p-3 transition-colors hover:border-brand-200">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      t.direction === 'credit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    )}
                  >
                    {t.direction === 'credit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{t.description ?? t.type.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {t.type.replace(/_/g, ' ')} · {new Date(t.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={cn('text-sm font-bold', t.direction === 'credit' ? 'text-success' : 'text-neutral-900')}>
                    {t.direction === 'credit' ? '+' : '-'}
                    <Price value={t.amount} size="sm" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-300" />
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      <Card className="flex items-start gap-3 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-sm text-neutral-600">
          Refunds and cashbacks for cancelled orders are automatically credited to this wallet.
        </p>
      </Card>

      <BottomSheet title="Add money" open={topupOpen} onOpenChange={setTopupOpen}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TOPUPS.map((t) => (
              <button
                key={t}
                onClick={() => setAmount(t)}
                className={cn(
                  'rounded-2xl border py-3 text-sm font-bold transition-colors',
                  amount === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                )}
              >
                <Price value={t} />
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={amount <= 0 || topup.isPending}
            onClick={() => topup.mutate(amount)}
          >
            {topup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add <Price value={amount} /> to wallet
          </Button>
          <p className="text-center text-xs text-neutral-500">Payment gateway integration coming soon.</p>
        </div>
      </BottomSheet>

      <TransactionDetail tx={txDetail} open={txDetail !== null} onClose={() => setTxDetail(null)} />
    </div>
  );
}

function TransactionDetail({ tx, open, onClose }: { tx: WalletTransaction | null; open: boolean; onClose: () => void }) {
  return (
    <BottomSheet title="Transaction details" open={open} onOpenChange={(o) => !o && onClose()}>
      {tx && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', tx.direction === 'credit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
              {tx.direction === 'credit' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-lg font-extrabold text-neutral-900">
                {tx.direction === 'credit' ? '+' : '-'}
                <Price value={tx.amount} />
              </p>
              <p className="text-xs text-neutral-500">{tx.transaction_id}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <DetailRow label="Type" value={tx.type.replace(/_/g, ' ')} />
            <DetailRow label="Date" value={new Date(tx.created_at).toLocaleString('en-IN')} />
            <DetailRow label="Status" value={tx.status} />
            <DetailRow label="Balance after" value={`₹${tx.balance_after}`} />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold capitalize text-neutral-800">{value}</span>
    </div>
  );
}