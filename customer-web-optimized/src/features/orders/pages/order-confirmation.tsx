import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Wallet as WalletIcon, Timer, ChevronRight } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { Card } from '@/shared/components/ui/card';
import { Price } from '@/shared/components/ui/price';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { SelectedOptionsList } from '@/shared/components/product/selected-options';
import { ErrorState } from '@/shared/components/ui/state';
import { serviceTheme } from '@/shared/components/service/service-theme';
import { useAppStore } from '@/shared/stores/appStore';
import type { ServiceType } from '@/shared/types/models';
import { cn } from '@/shared/utils/utils';

export function OrderConfirmationPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const setService = useAppStore((s) => s.setService);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repositories.orders.getOrder(orderId),
    enabled: Number.isFinite(orderId),
  });

  const service: ServiceType = order?.order_type === 'grocery' ? 'grocery' : 'food';
  const theme = serviceTheme(service);

  useEffect(() => {
    if (order) setService(service);
  }, [order, service, setService]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <ErrorState
        title="Order not found"
        action={{ label: 'Go to orders', onClick: () => (window.location.href = '/orders') }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section
        className={cn(
          'rounded-3xl bg-gradient-to-br p-6 text-center text-white',
          service === 'grocery' ? 'from-success to-emerald-700' : 'from-food-600 to-food-700'
        )}
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">Order confirmed!</h1>
        <p className="mt-1 text-sm text-white/80">We've received your order.</p>
        <p className="mt-3 text-sm font-semibold tracking-wide">{order.order_number}</p>
      </section>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-neutral-900">
            {order.order_type === 'grocery' ? 'Grocery order' : 'Food order'}
          </span>
          <Badge variant={order.status === 'CANCELLED' ? 'danger' : 'warning'}>{order.status.replace(/_/g, ' ')}</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {order.items?.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <img src={i.product_image ?? ''} alt={i.product_name} className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{i.product_name}</p>
                <SelectedOptionsList options={i.selected_options} className="mt-0.5" compact />
                <p className="text-xs text-neutral-500">
                  {i.quantity} × <Price value={i.unit_price} size="sm" />
                </p>
              </div>
              <span className="text-sm font-semibold text-neutral-800">
                <Price value={i.line_total} size="sm" />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-900">Total paid</span>
            <span className="text-lg font-extrabold text-neutral-900">
              <Price value={order.total_amount} />
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">via {order.payment_method?.replace(/_/g, ' ')}</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', theme.strong)} />
            <div>
              <p className="font-semibold text-neutral-900">Delivery address</p>
              <p className="text-neutral-500">
                {order.delivery_address_snapshot
                  ? `${order.delivery_address_snapshot.address_line_1}, ${order.delivery_address_snapshot.city}`
                  : 'Address on file'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <WalletIcon className={cn('mt-0.5 h-4 w-4 shrink-0', theme.strong)} />
            <div>
              <p className="font-semibold text-neutral-900">Payment</p>
              <p className="capitalize text-neutral-500">{order.payment_method?.replace(/_/g, ' ') ?? 'Online'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Timer className={cn('mt-0.5 h-4 w-4 shrink-0', theme.strong)} />
            <div>
              <p className="font-semibold text-neutral-900">Estimated delivery</p>
              <p className="text-neutral-500">
                {order.timing_type === 'scheduled' && order.scheduled_at
                  ? new Date(order.scheduled_at).toLocaleString('en-IN')
                  : '30–40 minutes'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link to={`/order/${order.id}`} className="flex-1">
          <Button variant={service === 'food' ? 'accent' : 'default'} className="w-full">
            Track Order <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="/orders" className="flex-1">
          <Button variant="outline" className="w-full">
            View Orders
          </Button>
        </Link>
        <Link to="/food" className="flex-1">
          <Button variant="secondary" className="w-full">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}