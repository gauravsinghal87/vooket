import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ReceiptText,
  TrendingUp,
  Store,
  Users,
  Wallet,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import { dashboardApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/ui/status';
import { formatCurrency, formatCompactCurrency, formatNumber, formatDateTime } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.get(7),
  });

  if (isLoading) return <Skeleton className="h-[520px]" />;
  if (isError || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState message="Failed to load dashboard" onRetry={() => refetch()} />
      </div>
    );
  }

  const { counts, revenue_series, order_status_distribution, recent_orders, top_vendors } = data;
  const maxRevenue = Math.max(1, ...revenue_series.map((p) => Number(p.gross_order_value)));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of the platform"
        actions={
          <Link to="/orders" className="text-sm font-semibold text-brand-600 hover:underline">
            View all orders
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's Orders" value={formatNumber(counts.today_orders)} icon={ReceiptText} tone="brand" />
        <StatCard label="Today's Gross Order Value" value={formatCompactCurrency(counts.today_gross_order_value)} icon={TrendingUp} tone="success" />
        <StatCard label="Total Gross Order Value" value={formatCompactCurrency(counts.total_gross_order_value)} icon={Wallet} tone="accent" />
        <StatCard label="Today's Platform Revenue" value={formatCompactCurrency(counts.today_platform_revenue)} sub="commission earned" icon={TrendingUp} tone="success" />
        <StatCard label="Total Platform Revenue" value={formatCompactCurrency(counts.total_platform_revenue)} sub="commission earned" icon={Wallet} tone="accent" />
        <StatCard
          label="Pending Vendors"
          value={formatNumber(counts.pending_vendors)}
          sub="awaiting approval"
          icon={Store}
          tone="violet"
        />
        <StatCard label="Total Users" value={formatNumber(counts.total_users)} icon={Users} tone="slate" />
        <StatCard label="Delivered" value={formatNumber(counts.delivered_orders)} icon={PackageCheck} tone="success" />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Orders & Gross Order Value — last 7 days</CardTitle>
          </CardHeader>
          <div className="flex h-56 items-end gap-2">
            {revenue_series.map((point) => (
              <div key={point.date} className="group flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-brand-500 transition-all group-hover:bg-brand-600" style={{ height: `${Math.max(4, (Number(point.gross_order_value) / maxRevenue) * 100)}%` }} title={formatCurrency(point.gross_order_value)} />
                </div>
                <span className="text-[10px] font-medium text-neutral-500">
                  {new Date(point.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 border-t border-ink-100 pt-3 text-xs text-neutral-500">
            {revenue_series.map((point) => (
              <span key={point.date} className="flex items-center gap-1">
                <span className="font-semibold text-neutral-800">{formatNumber(point.orders)}</span> orders ·{' '}
                {formatCurrency(point.gross_order_value)} GV · {formatCurrency(point.commission)} commission
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order status</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {order_status_distribution.slice(0, 6).map((row) => {
              const total = counts.total_orders || 1;
              const pct = Math.round((row.total / total) * 100);
              return (
                <div key={row.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium capitalize text-neutral-700">{row.status.toLowerCase()}</span>
                    <span className="text-neutral-500">
                      {formatNumber(row.total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="px-0 py-0 xl:col-span-2">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <THeadRow>
                <THeadCell>Order</THeadCell>
                <THeadCell>Customer</THeadCell>
                <THeadCell>Vendor</THeadCell>
                <THeadCell>Total</THeadCell>
                <THeadCell>Status</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {recent_orders.map((o) => (
                <TRow key={o.id} onClick={() => navigate(`/orders?focus=${o.id}`)}>
                  <TCell>
                    <span className="font-semibold text-neutral-900">{o.order_number}</span>
                    <span className="block text-xs text-neutral-400">{formatDateTime(o.created_at)}</span>
                  </TCell>
                  <TCell>{o.user?.name ?? '—'}</TCell>
                  <TCell>
                    {o.vendor?.business_name ?? '—'}
                    <span className="block text-xs capitalize text-neutral-400">{o.vendor?.vendor_type}</span>
                  </TCell>
                  <TCell className="font-semibold">{formatCurrency(o.total_amount)}</TCell>
                  <TCell>
                    <OrderStatusBadge status={o.status} />
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top vendors by sales</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {top_vendors.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xs font-bold text-neutral-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{v.business_name}</p>
                  <p className="text-xs capitalize text-neutral-500">
                    {v.vendor_type === 'grocery' ? 'Grocery store' : 'Restaurant'} · {formatNumber(v.orders_count)} orders ·{' '}
                    {formatCompactCurrency(v.gross_order_value)} GV
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{formatCompactCurrency(v.commission)}</span>
              </div>
            ))}
          </div>
          <Link to="/vendors" className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            Manage vendors <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>
    </>
  );
}