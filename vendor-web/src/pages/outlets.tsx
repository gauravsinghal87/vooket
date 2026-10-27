import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, Star, Package, ReceiptText } from 'lucide-react';
import { outletsApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { StatusBadge } from '@/components/ui/status';

export function OutletsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-outlets'],
    queryFn: () => outletsApi.list(),
  });

  return (
    <>
      <PageHeader title="My outlets" description="All the restaurants and stores under your business" />

      {isLoading ? (
        <Skeleton className="py-10" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-10 text-center text-sm text-neutral-400">
          No outlets yet.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((outlet) => (
            <div key={outlet.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
              {outlet.cover_image || outlet.logo ? (
                <div className="relative h-36">
                  <img
                    src={outlet.cover_image ?? outlet.logo ?? ''}
                    alt={outlet.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-3 top-3">
                    <StatusBadge status={outlet.is_open ? 'open' : 'closed'} />
                  </div>
                </div>
              ) : (
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-ink-100 to-ink-50">
                  <span className="text-4xl font-black text-neutral-300">{outlet.name.charAt(0)}</span>
                  <div className="absolute right-3 top-3">
                    <StatusBadge status={outlet.is_open ? 'open' : 'closed'} />
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-neutral-900">{outlet.name}</h3>
                      {outlet.cuisine_type && (
                        <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] text-neutral-500">
                          {outlet.cuisine_type}
                        </span>
                      )}
                    </div>
                    {outlet.description && <p className="mt-0.5 text-sm text-neutral-500">{outlet.description}</p>}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
                  {outlet.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> {outlet.address}
                    </p>
                  )}
                  {outlet.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> {outlet.phone}
                    </p>
                  )}
                  {(outlet.opens_at || outlet.closes_at) && (
                    <p className="text-xs text-neutral-400">
                      Hours: {outlet.opens_at} – {outlet.closes_at}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 border-t border-ink-100 pt-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    {outlet.rating ? Number(outlet.rating).toFixed(1) : '—'} ({outlet.rating_count ?? 0})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> {outlet.products_count} products
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ReceiptText className="h-3.5 w-3.5" /> {outlet.orders_count} orders
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}