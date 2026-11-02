import { MapPinOff } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/utils';
import type { Serviceability } from '@/shared/types/api';

interface ServiceabilityNoticeProps {
  /**
   * The backend verdict for the requested delivery location. When it is missing
   * (endpoint did not report one) or reports the location *is* serviceable the
   * notice renders nothing.
   */
  serviceability?: Serviceability | null;
  /** Opens the shared delivery-location selector. */
  onChangeLocation: () => void;
  className?: string;
}

/**
 * The unavailable-location state every Food listing surface shares.
 *
 * The backend is the only authority on serviceability: when it reports the
 * delivery location is outside the served area — or inside a zone where Food is
 * switched off — the listing surfaces render this instead of restaurants. They
 * must never fall back to an unfiltered list.
 */
export function ServiceabilityNotice({ serviceability, onChangeLocation, className }: ServiceabilityNoticeProps) {
  if (!serviceability || serviceability.is_serviceable) return null;

  const foodDisabled = serviceability.reason === 'SERVICE_NOT_AVAILABLE_IN_ZONE';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-8 py-14 text-center animate-fade-in',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-food-50 text-food-600">
        <MapPinOff className="h-8 w-8" />
      </div>
      <div className="max-w-md">
        <h3 className="text-base font-semibold text-neutral-900">
          {foodDisabled ? "Food isn’t available in your area yet" : "We're not serving your location yet"}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {foodDisabled
            ? 'Your delivery address is inside a service zone where Food is not switched on yet. Try another delivery address to see what is available.'
            : "We're expanding our delivery coverage. Try another delivery address to discover restaurants available in your area."}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onChangeLocation}>
        Change location
      </Button>
    </div>
  );
}
