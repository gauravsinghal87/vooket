import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { storesApi } from '@/repositories/admin';
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

export function StoresPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stores', page, search],
    queryFn: () => storesApi.list({ page, search: search || null }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => storesApi.toggle(id, 'is_open'),
    onSuccess: () => {
      toast('Store open status updated');
      void qc.invalidateQueries({ queryKey: ['admin-stores'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Grocery Stores"
        description="Manage grocery store partners"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add store
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search stores…"
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
                  <THeadCell>Store</THeadCell>
                  <THeadCell>Type</THeadCell>
                  <THeadCell>Partner</THeadCell>
                  <THeadCell>Rating</THeadCell>
                  <THeadCell>Orders</THeadCell>
                  <THeadCell>Revenue</THeadCell>
                  <THeadCell>Open</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((s) => (
                  <TRow key={s.id}>
                    <TCell>
                      <div className="flex items-center gap-3">
                        {s.logo ? <img src={s.logo} alt={s.name} className="h-9 w-9 rounded-lg object-cover" /> : <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">{s.name?.charAt(0)}</span>}
                        <div>
                          <p className="font-semibold text-neutral-900">{s.name}</p>
                          <p className="text-xs text-neutral-400">#{s.id}</p>
                        </div>
                      </div>
                    </TCell>
                    <TCell className="text-sm capitalize">{s.store_type ?? '—'}</TCell>
                    <TCell className="text-sm">{s.vendor?.business_name ?? '—'}</TCell>
                    <TCell>{s.rating ? Number(s.rating).toFixed(1) : '—'}</TCell>
                    <TCell>{s.orders_count ?? 0}</TCell>
                    <TCell className="font-medium">{s.orders_sum_total_amount ? formatCompactCurrency(s.orders_sum_total_amount) : '—'}</TCell>
                    <TCell>
                      <StatusBadge status={s.is_open ? 'active' : 'inactive'} />
                    </TCell>
                    <TCell className="text-right">
                      <Button
                        size="sm"
                        variant={s.is_open ? 'outline' : 'success'}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(s.id)}
                      >
                        {s.is_open ? 'Close' : 'Open'}
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