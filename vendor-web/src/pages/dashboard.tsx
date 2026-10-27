import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  ReceiptText,
  Clock4,
  Flame,
  CheckCircle2,
  XCircle,
  Package,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { dashboardApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { StatusBadge } from '@/components/ui/status';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { formatCompactCurrency, formatCurrency, formatDateTime } from '@/lib/utils';

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: () => dashboardApi.get(7),
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { counts, revenue_series: series, status_distribution: distribution, recent_orders, top_products } = data;
  const maxRevenue = Math.max(1, ...series.map((s) => s.revenue));

  return (
    <>
      <PageHeader
        title={`Welcome, ${counts.vendor.business_name}`}
        description="Here's what's happening with your business today"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={counts.vendor.status} />
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <Star className="h-3 w-3 fill-current" /> {counts.vendor.rating.toFixed(1)}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's revenue" value={formatCurrency(counts.today_revenue)} icon={IndianRupee} tone="brand" sub={`₹${formatCompactCurrency(counts.total_revenue)} all-time`} />
        <StatCard label="Today's orders" value={counts.today_orders} icon={ReceiptText} tone="violet" sub={`${counts.total_orders} total orders`} />
        <StatCard label="Pending" value={counts.pending_orders} icon={Clock4} tone="warning" sub={`${counts.active_orders} active right now`} />
        <StatCard label="Delivered" value={counts.delivered_orders} icon={CheckCircle2} tone="success" sub={`${counts.cancelled_orders} cancelled`} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active products" value={counts.active_products} icon={Package} tone="brand" sub={`${counts.total_products} in catalogue`} />
        <StatCard label="Out of stock" value={counts.out_of_stock} icon={AlertTriangle} tone="accent" sub="Marked unavailable" />
        <StatCard label="Sales rate" value={`${counts.vendor.commission_rate}%`} icon={Flame} tone="accent" sub="Platform commission" />
        <StatCard
          label={counts.vendor.vendor_type === 'grocery' ? 'Stores' : 'Restaurants'}
          value={counts.vendor.vendor_type === 'grocery' ? counts.stores_count : counts.restaurants_count}
          icon={XCircle}
          tone="slate"
          sub="Active outlets"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-neutral-900">Revenue · last 7 days</h2>
              <p className="text-xs text-neutral-400">Orders placed and revenue earned</p>
            </div>
          </div>
          <div className="mt-4 flex h-40 items-end gap-2">
            {series.map((s) => (
              <div key={s.date} className="group relative flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-brand-600/80 transition-all group-hover:bg-brand-600"
                    style={{ height: `${Math.max(4, (s.revenue / maxRevenue) * 100)}%` }}
                    title={`${s.date}: ₹${s.revenue}`}
                  />
                </div>
                <span className="text-[10px] font-medium text-neutral-400">
                  {new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-neutral-900">Order status</h2>
          <div className="mt-4 space-y-3">
            {distribution.length === 0 && <p className="text-sm text-neutral-400">No orders yet.</p>}
            {distribution.map((d) => {
              const total = distribution.reduce((a, b) => a + b.total, 0) || 1;
              return (
                <div key={d.status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <StatusBadge status={d.status.toLowerCase()} />
                    <span className="text-xs text-neutral-400">{d.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${(d.total / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 px-0 py-0">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="font-bold text-neutral-900">Recent orders</h2>
            <Link to="/orders" className="text-sm font-semibold text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {recent_orders.length === 0 ? (
            <p className="p-6 text-sm text-neutral-400">No orders yet.</p>
          ) : (
            <Table>
              <THead>
                <THeadRow>
                  <THeadCell>Order</THeadCell>
                  <THeadCell>Customer</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell className="text-right">Amount</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {recent_orders.map((o) => (
                  <TRow key={o.id}>
                    <TCell>
                      <p className="font-medium text-neutral-900">{o.order_number}</p>
                      <p className="text-xs text-neutral-400">{formatDateTime(o.created_at)}</p>
                    </TCell>
                    <TCell className="text-sm">{o.user?.name ?? '—'}</TCell>
                    <TCell>
                      <StatusBadge status={o.status.toLowerCase()} />
                    </TCell>
                    <TCell className="text-right font-medium">{formatCurrency(o.total_amount)}</TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-neutral-900">Top products</h2>
          {top_products.length === 0 && <p className="mt-4 text-sm text-neutral-400">No sales yet.</p>}
          <div className="mt-4 space-y-3">
            {top_products.map((p) => (
              <div key={p.product_id} className="flex items-center gap-3">
                {p.product_image ? (
                  <img src={p.product_image} alt={p.product_name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-xs text-neutral-400">
                    No img
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{p.product_name}</p>
                  <p className="text-xs text-neutral-400">{p.sold} sold</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}