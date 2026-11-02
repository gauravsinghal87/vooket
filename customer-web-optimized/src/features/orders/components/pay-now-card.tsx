import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2 } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { completeOrderPayment, createUsableCheckout } from '@/shared/services/razorpay';
import { Card } from '@/shared/components/ui/card';
import { Price } from '@/shared/components/ui/price';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/shared/components/ui/toast';
import { cn } from '@/shared/utils/utils';
import type { Order } from '@/shared/types/models';

export function PayNowCard({ order, tone = 'brand' }: { order: Order; tone?: 'brand' | 'food' | 'grocery' }) {
  const queryClient = useQueryClient();
  const isFood = tone === 'food';
  const isGrocery = tone === 'grocery';

  const pay = useMutation({
    mutationFn: async () => {
      const checkout = await createUsableCheckout(
        (idempotencyKey) =>
          repositories.payments.initiate({
            payable_type: 'order',
            payable_id: order.id,
            payment_method: 'card',
            idempotency_key: idempotencyKey,
          }),
        `order:pay:${order.id}`
      );

      return completeOrderPayment(checkout);
    },
    onSuccess: (result) => {
      if (result.status === 'paid') {
        toast('Payment successful!');
        queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error'),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            isFood ? 'bg-food-50 text-food-700' : isGrocery ? 'bg-grocery-100 text-grocery-800' : 'bg-brand-100 text-brand-700'
          )}
        >
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900">Payment pending</p>
          <p className="text-xs text-neutral-500">
            Order total <Price value={order.total_amount} size="sm" /> ·{' '}
            {order.payment_method === 'cash_on_delivery'
              ? 'Pay online now to skip cash at the door.'
              : 'Complete payment to confirm your order.'}
          </p>
        </div>
      </div>
      <Button
        variant={isFood ? 'accent' : isGrocery ? 'grocery' : 'default'}
        className="mt-3 w-full"
        onClick={() => pay.mutate()}
        disabled={pay.isPending}
      >
        {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {pay.isPending ? 'Processing…' : 'Pay now'}
      </Button>
    </Card>
  );
}