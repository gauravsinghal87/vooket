import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { restaurantsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { formatCompactCurrency } from '@/lib/utils';

export function RestaurantsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-restaurants', page, search],
    queryFn: () => restaurantsApi.list({ page, search: search || null }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => restaurantsApi.toggle(id, 'is_open'),
    onSuccess: () => {
      toast('Restaurant open status updated');
      void qc.invalidateQueries({ queryKey: ['admin-restaurants'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Restaurants"
        description="Manage restaurant partners"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add restaurant
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search restaurants…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="w-64 pl-9"
          />
        </div>
      </div>

      <Card className="px-0 py-0">
        {isLoading ? (
          <Skeleton className="p-6" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <Table>
              <THead>
                <THeadRow>
                  <THeadCell>Restaurant</THeadCell>
                  <THeadCell>Cuisine</THeadCell>
                  <THeadCell>Partner</THeadCell>
                  <THeadCell>Rating</THeadCell>
                  <THeadCell>Orders</THeadCell>
                  <THeadCell>Revenue</THeadCell>
                  <THeadCell>Open</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((r) => (
                  <TRow key={r.id}>
                    <TCell>
                      <div className="flex items-center gap-3">
                        {r.logo ? <img src={r.logo} alt={r.name} className="h-9 w-9 rounded-lg object-cover" /> : <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">{r.name?.charAt(0)}</span>}
                        <div>
                          <p className="font-semibold text-neutral-900">{r.name}</p>
                          <p className="text-xs text-neutral-400">#{r.id} · {r.is_featured ? 'featured' : '—'}</p>
                        </div>
                      </div>
                    </TCell>
                    <TCell className="text-sm">{r.cuisine_type ?? '—'}</TCell>
                    <TCell className="text-sm">{r.vendor?.business_name ?? '—'}</TCell>
                    <TCell>{r.rating ? Number(r.rating).toFixed(1) : '—'}</TCell>
                    <TCell>{r.orders_count ?? 0}</TCell>
                    <TCell className="font-medium">{r.orders_sum_total_amount ? formatCompactCurrency(r.orders_sum_total_amount) : '—'}</TCell>
                    <TCell>
                      <StatusBadge status={r.is_open ? 'active' : 'inactive'} />
                    </TCell>
                    <TCell className="text-right">
                      <Button
                        size="sm"
                        variant={r.is_open ? 'outline' : 'success'}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(r.id)}
                      >
                        {r.is_open ? 'Close' : 'Open'}
                      </Button>
                    </TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}