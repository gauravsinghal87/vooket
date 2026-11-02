import { useQuery } from '@tanstack/react-query';
import { KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/utils';

interface DeliveryOtpCardProps {
  orderId: number;
  active: boolean;
  tone?: 'brand' | 'food' | 'grocery';
}

export function DeliveryOtpCard({ orderId, active, tone = 'brand' }: DeliveryOtpCardProps) {
  const grocery = tone === 'grocery';
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['order', orderId, 'delivery-otp'],
    queryFn: () => repositories.orders.getDeliveryOtp(orderId),
    enabled: active,
    retry: false,
    refetchInterval: active ? 15_000 : false,
  });

  if (!active) return null;

  if (isError && error instanceof Error) {
    const waitingForPartner = error.message.includes('Ask your delivery partner');

    return (
      <Card className="p-4">
        <div className={cn('rounded-2xl p-4 text-sm', waitingForPartner ? 'bg-neutral-50 text-neutral-600' : 'bg-amber-50 text-amber-700')}>
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" />
            {waitingForPartner ? 'Delivery OTP not ready yet' : 'Delivery code unavailable'}
          </div>
          <p className="mt-1 text-xs">
            {waitingForPartner
              ? 'Your delivery partner will request your code when they arrive.'
              : error.message}
          </p>
          {!waitingForPartner && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Try again
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (isPending || !data) {
    return (
      <Card className="animate-pulse p-4">
        <div className="h-4 w-40 rounded bg-neutral-100" />
        <div className="mt-3 h-10 w-32 rounded bg-neutral-100" />
      </Card>
    );
  }

  const expiresAt = new Date(data.expires_at);
  const expired = Number.isNaN(expiresAt.getTime()) ? false : expiresAt.getTime() <= Date.now();

  return (
    <Card className="overflow-hidden">
      <div className={cn('flex items-center gap-2 border-b border-neutral-100 px-4 py-3', tone === 'food' ? 'bg-food-50/60' : grocery ? 'bg-grocery-100/60' : 'bg-brand-50/60')}>
        <KeyRound className={cn('h-4 w-4', tone === 'food' ? 'text-food-600' : grocery ? 'text-grocery-700' : 'text-brand-600')} />
        <p className="text-sm font-bold text-neutral-900">Delivery verification</p>
        <span className="ml-auto text-xs text-neutral-500">for your order</span>
      </div>
      <div className="p-4">
        <p className="text-xs text-neutral-500">Your delivery partner needs this 6-digit code to complete delivery.</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Delivery OTP</p>
            <p className={cn('text-3xl font-extrabold tracking-[0.3em]', tone === 'food' ? 'text-food-700' : grocery ? 'text-grocery-700' : 'text-brand-700')}>{data.otp}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {expired ? 'This code has expired — ask your partner to request a new one.' : `Valid until ${expiresAt.toLocaleTimeString('en-IN')}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
          Share this code with your delivery partner to confirm your delivery. Don't share it with anyone else.
        </p>
      </div>
    </Card>
  );
}