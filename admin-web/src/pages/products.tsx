import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { productsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';

export function ProductsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-products', page, search],
    queryFn: () => productsApi.list({ page, search: search || null }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => productsApi.toggle(id, 'is_active'),
    onSuccess: () => {
      toast('Product updated');
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader title="Products" description="Catalog items across all partners" />

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search products…"
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
                  <THeadCell>Product</THeadCell>
                  <THeadCell>Outlet</THeadCell>
                  <THeadCell>Category</THeadCell>
                  <THeadCell>Price</THeadCell>
                  <THeadCell>Availability</THeadCell>
                  <THeadCell>Active</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((p) => (
                  <TRow key={p.id}>
                    <TCell>
                      <div className="flex items-center gap-3">
                        {p.image ? <img src={p.image} alt={p.name} className="h-10 w-10 rounded-lg object-cover" /> : <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-xs font-bold text-neutral-400">{p.name?.charAt(0)}</span>}
                        <div>
                          <p className="font-semibold text-neutral-900">{p.name}</p>
                          <p className="text-xs text-neutral-400">#{p.id} · {p.type ?? p.category?.name ?? '—'}</p>
                        </div>
                      </div>
                    </TCell>
                    <TCell className="text-sm">
                      {p.vendor?.business_name ?? p.restaurant?.name ?? p.store?.name ?? '—'}
                    </TCell>
                    <TCell className="text-sm">{p.category?.name ?? '—'}</TCell>
                    <TCell className="font-medium">{p.price ? `₹${Number(p.price).toLocaleString('en-IN')}` : '—'}</TCell>
                    <TCell>
                      <StatusBadge status={p.is_available ? 'available' : 'unavailable'} />
                    </TCell>
                    <TCell>
                      <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
                    </TCell>
                    <TCell className="text-right">
                      <Button
                        size="sm"
                        variant={p.is_active ? 'outline' : 'success'}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(p.id)}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
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