import { BadgeCheck, HandCoins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import type { Order } from '@/types/models';

export function PaymentReceivedCard({ order }: { order: Order }) {
  const status = (order.payment_status ?? '').toLowerCase();
  const refunded = status.includes('refund');
  const label = order.payment_status == null ? '' : order.payment_status.replace(/_/g, ' ');

  return (
    <Card className={refunded ? 'border-warning/30 p-4' : 'border-success/30 p-4'}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${refunded ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          <BadgeCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900">{refunded ? 'Refunded' : 'Payment received'}</p>
          <p className="text-xs text-neutral-500">
            {label || 'Paid'} · <Price value={order.total_amount} size="sm" /> via online payment
          </p>
        </div>
      </div>
    </Card>
  );
}

export function CashCollectedCard({ order }: { order: Order }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
          <HandCoins className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900">Paid in cash</p>
          <p className="text-xs text-neutral-500">
            Your delivery partner collected <Price value={order.total_amount} size="sm" /> at your door.
          </p>
        </div>
      </div>
    </Card>
  );
}