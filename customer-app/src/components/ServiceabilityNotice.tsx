import { EmptyState } from '@/components/ui/primitives';
import { useAppStore } from '@/stores/appStore';
import type { Serviceability } from '@/types/api';

interface ServiceabilityNoticeProps {
  /**
   * The backend verdict for the requested delivery location. When it is
   * missing (the endpoint did not report one) or reports the location *is*
   * serviceable, the notice renders nothing.
   */
  serviceability?: Serviceability | null;
}

/**
 * The unavailable-location state every Food listing surface shares.
 *
 * The backend is the only authority on serviceability: when it reports the
 * delivery location is outside the served area — or inside a zone where Food is
 * switched off — the listing surfaces render this instead of restaurants. They
 * never fall back to an unfiltered list, and the app never derives the zone
 * itself.
 *
 * "Change location" opens the single delivery-location sheet that `AppHeader`
 * renders, so there is exactly one selector in the app.
 */
export function ServiceabilityNotice({ serviceability }: ServiceabilityNoticeProps) {
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);

  if (!serviceability || serviceability.is_serviceable) return null;

  const foodDisabled = serviceability.reason === 'SERVICE_NOT_AVAILABLE_IN_ZONE';

  return (
    <EmptyState
      title={foodDisabled ? "Food isn't available in your area yet" : "We're not serving your location yet"}
      message={
        foodDisabled
          ? 'Your delivery address is inside a service zone where Food is not switched on yet. Try another delivery address to see what is available.'
          : "We're expanding our delivery coverage. Try another delivery address to discover restaurants available in your area."
      }
      actionLabel="Change location"
      onAction={openLocationSelector}
    />
  );
}
