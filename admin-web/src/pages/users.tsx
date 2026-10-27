import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { usersApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatDateTime, timeFromNow } from '@/lib/utils';

export function UsersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', page, search, status],
    queryFn: () => usersApi.list({ page, search: search || null, status: status || null }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'activate' | 'ban' }) =>
      usersApi.setStatus(id, action),
    onSuccess: (_d, vars) => {
      toast(vars.action === 'ban' ? 'User banned' : 'User activated');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Action failed', 'error'),
  });

  return (
    <>
      <PageHeader title="Customers" description="All registered users and their activity" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="w-72 pl-9"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="banned">Banned</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Refresh
        </Button>
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
                  <THeadCell>User</THeadCell>
                  <THeadCell>Contact</THeadCell>
                  <THeadCell>Roles</THeadCell>
                  <THeadCell>Orders</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell>Joined</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((u) => {
                  const banned = Boolean(u.banned_at);
                  const active = u.is_active && !banned;
                  return (
                    <TRow key={u.id}>
                      <TCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatar ?? null} />
                          <div>
                            <p className="font-semibold text-neutral-900">{u.name}</p>
                            <p className="text-xs text-neutral-400">#{u.id}</p>
                          </div>
                        </div>
                      </TCell>
                      <TCell>
                        <p className="text-sm">{u.email}</p>
                        <p className="text-xs text-neutral-400">{u.phone ?? '—'}</p>
                      </TCell>
                      <TCell className="text-xs capitalize">
                        {u.roles?.map((r) => r.name.toLowerCase()).join(', ') || 'customer'}
                      </TCell>
                      <TCell>{u.orders_count ?? 0}</TCell>
                      <TCell>
                        <StatusBadge status={banned ? 'banned' : active ? 'active' : 'inactive'} />
                      </TCell>
                      <TCell>
                        <p className="text-sm">{formatDateTime(u.created_at)}</p>
                        <p className="text-xs text-neutral-400">{timeFromNow(u.created_at)}</p>
                      </TCell>
                      <TCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {active ? (
                            <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: u.id, action: 'ban' })}>
                              Ban
                            </Button>
                          ) : (
                            <Button size="sm" variant="success" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: u.id, action: 'activate' })}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </TCell>
                    </TRow>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}