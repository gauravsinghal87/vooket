import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featureFlagsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';

export function FeatureFlagsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => featureFlagsApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => featureFlagsApi.toggle(id),
    onSuccess: () => {
      toast('Feature flag updated');
      void qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const flags = data ?? [];

  return (
    <>
      <PageHeader title="Feature Flags" description="Globally enable or disable features" />

      {flags.length === 0 ? (
        <ErrorState message="No feature flags configured yet. Check backend/database/seeders/ConfigurationSeeder.php" />
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <Card key={f.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-semibold text-neutral-900">{f.name ?? f.key}</p>
                <p className="text-xs text-neutral-400">
                  <code className="rounded bg-ink-50 px-1.5 py-0.5">{f.key}</code>
                  {f.description ? ` · ${f.description}` : ''}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={f.enabled}
                disabled={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate(f.id)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${f.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}