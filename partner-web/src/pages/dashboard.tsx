import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Wifi, WifiOff, CarTaxiFront, Bike } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { getCurrentPosition } from '@/lib/geo';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat';
import { Skeleton } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { ActiveJobPanel } from '@/components/jobs/ActiveJob';
import { RequestQueue } from '@/components/jobs/RequestQueue';
import type { PartnerRole } from '@/typings/models';

export function DashboardPage() {
  const role = useAuthStore((s) => s.role) as PartnerRole;
  return role === 'delivery_partner' ? <PartnerDashboard /> : <DriverDashboard />;
}

function useAvailability() {
  const qc = useQueryClient();
  const { profile, role, setOnline } = useAuthStore();
  const api = role === 'delivery_partner' ? partnerApi : driverApi;

  const mutation = useMutation({
    mutationFn: async () => {
      const wantOnline = !(profile?.is_online ?? false);
      if (wantOnline) {
        const coords = await getCurrentPosition();
        await api.updateLocation(coords.latitude, coords.longitude);
      }
      return api.toggleAvailability();
    },
    onSuccess: (res) => {
      setOnline(res.is_online);
      toast(res.is_online ? 'You are now online' : 'You are offline');
      void qc.invalidateQueries();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return { isOnline: profile?.is_online ?? false, busy: profile?.is_busy ?? false, toggle: () => mutation.mutate(), pending: mutation.isPending };
}

function AvailabilityToggle() {
  const { isOnline, busy, toggle, pending } = useAvailability();
  return (
    <Button
      variant={isOnline ? 'outline' : 'success'}
      disabled={pending || busy}
      onClick={toggle}
      className={isOnline ? 'text-ink-700' : ''}
    >
      {isOnline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
      {busy ? 'On a job…' : isOnline ? 'Go offline' : 'Go online'}
    </Button>
  );
}

function DriverDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['driver-earnings'],
    queryFn: () => driverApi.earnings(),
  });

  return (
    <>
      <PageHeader
        title="Driver dashboard"
        description="Accept rides and manage your availability"
        actions={<AvailabilityToggle />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatCurrency(data?.today ?? 0)} icon={CarTaxiFront} tone="brand" sub="Earned today" />
        <StatCard label="This week" value={formatCurrency(data?.this_week ?? 0)} icon={CarTaxiFront} tone="success" />
        <StatCard label="Total earned" value={formatCurrency(data?.total ?? 0)} icon={CarTaxiFront} tone="violet" />
        <StatCard label="Total trips" value={formatNumber(data?.total_trips ?? 0)} icon={CarTaxiFront} tone="accent" />
      </div>

      <div className="mb-6">
        {isLoading ? (
          <Skeleton className="p-6" rows={2} />
        ) : (
          <ActiveJobPanel />
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Incoming ride requests</h2>
      <RequestQueue />
    </>
  );
}

function PartnerDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['partner-earnings'],
    queryFn: () => partnerApi.earnings(),
  });

  return (
    <>
      <PageHeader
        title="Delivery dashboard"
        description="Accept deliveries and manage your availability"
        actions={<AvailabilityToggle />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatCurrency(data?.today ?? 0)} icon={Bike} tone="brand" sub="Earned today" />
        <StatCard label="This week" value={formatCurrency(data?.this_week ?? 0)} icon={Bike} tone="success" />
        <StatCard label="Total earned" value={formatCurrency(data?.total ?? 0)} icon={Bike} tone="violet" />
        <StatCard label="Total deliveries" value={formatNumber(data?.total_deliveries ?? 0)} icon={Bike} tone="accent" />
      </div>

      <div className="mb-6">
        {isLoading ? (
          <Skeleton className="p-6" rows={2} />
        ) : (
          <ActiveJobPanel />
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Incoming deliveries</h2>
      <RequestQueue />
    </>
  );
}