import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/ui/page-header';
import { ActiveJobPanel } from '@/components/jobs/ActiveJob';
import { RequestQueue } from '@/components/jobs/RequestQueue';
import type { PartnerRole } from '@/typings/models';

export function RequestsPage() {
  const role = useAuthStore((s) => s.role) as PartnerRole;
  const profile = useAuthStore((s) => s.profile);
  const serviceType = profile && 'service_type' in profile ? profile.service_type : null;

  const title =
    role === 'delivery_partner'
      ? serviceType === 'grocery'
        ? 'Grocery deliveries'
        : serviceType === 'food'
          ? 'Food deliveries'
          : 'Incoming deliveries'
      : 'Ride requests';

  const description =
    role === 'delivery_partner'
      ? serviceType === 'grocery'
        ? 'Grocery orders waiting to be accepted'
        : serviceType === 'food'
          ? 'Food orders waiting to be accepted'
          : 'Delivery orders waiting to be accepted'
      : 'Ride requests waiting to be accepted';

  return (
    <PageHeader title={title} description={description}>
      <div className="space-y-6">
        <ActiveJobPanel />
        <RequestQueue />
      </div>
    </PageHeader>
  );
}