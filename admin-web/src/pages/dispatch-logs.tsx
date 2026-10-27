import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { dispatchApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';

const statuses = ['pending', 'sent', 'accepted', 'rejected', 'expired', 'assigned'];

export function DispatchLogsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dispatch-logs', page, status, refreshKey],
    queryFn: () => dispatchApi.logs({ page, status: status || null }),
  });

  return (
    <>
      <PageHeader
        title="Dispatch logs"
        description="Offer lifecycle for delivered orders and assigned rides, in the order they were created"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4" /> Refresh
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
                  <THeadCell>Reference</THeadCell>
                  <THeadCell>Type</THeadCell>
                  <THeadCell>Partner</THeadCell>
                  <THeadCell>Distance</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell>Offered</THeadCell>
                  <THeadCell>Expires</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((log) => (
                  <TRow key={log.id}>
                    <TCell>
                      <p className="font-semibold text-neutral-900">
                        {log.ride?.ride_number ?? log.order?.order_number ?? '—'}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {(log.ride?.status ?? log.order?.status)?.toLowerCase().replace(/_/g, ' ') ?? '—'}
                      </p>
                    </TCell>
                    <TCell>
                      <span className="text-sm capitalize">{log.dispatch_type ?? log.candidate_type?.replace(/_/g, ' ')}</span>
                    </TCell>
                    <TCell className="text-sm">
                      {log.driver?.user?.name ?? log.delivery_partner?.user?.name ?? '—'}
                    </TCell>
                    <TCell className="text-sm">
                      {log.distance_km !== null && log.distance_km !== undefined ? `${log.distance_km} km` : '—'}
                    </TCell>
                    <TCell>
                      <StatusBadge status={log.status} />
                    </TCell>
                    <TCell className="text-xs text-neutral-400">{formatDateTime(log.created_at)}</TCell>
                    <TCell className="text-xs text-neutral-400">{formatDateTime(log.expires_at)}</TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
            {data.data.length === 0 && <p className="px-6 py-10 text-center text-sm text-neutral-400">No dispatch logs found</p>}
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}