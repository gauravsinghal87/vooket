import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, X, Wallet as WalletIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { completeWalletTopup } from '@/lib/razorpay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { formatMoney } from '@/lib/utils';

interface AddMoneyModalProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  /** Prefilled top-up amount (e.g. the settlement shortfall). */
  suggested?: number;
  onCredited?: (balance: number) => void;
}

export function AddMoneyModal({ open, onClose, label, suggested, onCredited }: AddMoneyModalProps) {
  const role = useAuthStore((s) => s.role);
  const repository = role === 'delivery_partner' ? partnerApi : driverApi;
  const [amount, setAmount] = useState<string>(suggested && suggested > 0 ? String(Math.ceil(suggested)) : '');

  const topup = useMutation({
    mutationFn: async () => {
      const numeric = Number(amount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error('Enter a valid amount');
      }
      const checkout = await repository.walletTopup(numeric, 'upi', `topup:${Date.now()}`);
      const result = await completeWalletTopup(checkout, repository.verifyWalletTopup);
      if (!result || result.status !== 'SUCCESS') {
        throw new Error('Top-up was not completed');
      }
      return result;
    },
    onSuccess: (result) => {
      toast('Money added to your wallet');
      onCredited?.(result.wallet.available_balance ?? result.wallet.balance);
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Top-up failed', 'error'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-neutral-900">Add money</p>
              <p className="text-xs text-neutral-500">{label ?? 'Top up your wallet to settle cash collected.'}</p>
            </div>
          </div>
          <button type="button" className="text-neutral-400 hover:text-neutral-600" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            disabled={topup.isPending}
          />
          {suggested && suggested > 0 && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Suggested: {formatMoney(Math.ceil(suggested))} — enough to cover the cash settlement shortfall.
            </p>
          )}
        </div>

        <Button className="mt-4 w-full" onClick={() => topup.mutate()} disabled={topup.isPending}>
          {topup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {topup.isPending ? 'Processing…' : 'Add money'}
        </Button>
      </div>
    </div>
  );
}