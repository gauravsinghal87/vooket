import { EmptyState } from '@/components/ui/primitives';
import { useAppStore } from '@/stores/appStore';
import type { Serviceability } from '@/types/api';

interface GroceryServiceabilityNoticeProps {
  /**
   * The backend verdict for the requested delivery location. When it is
   * missing (the endpoint did not report one) or reports the location *is*
   * serviceable, the notice renders nothing.
   */
  serviceability?: Serviceability | null;
}

/**
 * The unavailable-location state every Grocery listing surface shares.
 *
 * The backend is the only authority on serviceability: when it reports the
 * delivery location is outside the served area — or inside a zone where Grocery
 * is switched off — stores, categories, products, carousels and grocery search
 * results are replaced by this state. They never fall back to an unfiltered
 * list, and the app never derives the zone itself (no client-side geofence).
 *
 * "Change location" opens the single delivery-location sheet that `AppHeader`
 * renders, so there is exactly one selector in the app. This is the Grocery
 * twin of `ServiceabilityNotice`, with its own copy so Food surfaces keep
 * rendering exactly what they always have.
 */
export function GroceryServiceabilityNotice({ serviceability }: GroceryServiceabilityNoticeProps) {
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);

  if (!serviceability || serviceability.is_serviceable) return null;

  const groceryDisabled = serviceability.reason === 'SERVICE_NOT_AVAILABLE_IN_ZONE';

  return (
    <EmptyState
      // Required unavailable-location message, shown for every reason the
      // backend reports (outside coverage, invalid/missing coordinates or
      // Grocery switched off inside the zone).
      title="We're not serving your location yet"
      message={
        groceryDisabled
          ? "Grocery isn't switched on at this delivery address yet. Try another delivery address to discover stores available in your area."
          : "We're expanding our delivery coverage. Try another delivery address to discover stores available in your area."
      }
      actionLabel="Change location"
      onAction={openLocationSelector}
    />
  );
}
