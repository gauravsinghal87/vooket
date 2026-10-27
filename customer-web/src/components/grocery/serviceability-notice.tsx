import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Serviceability } from '@/types/api';

interface GroceryServiceabilityNoticeProps {
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
 * The unavailable-location state every Grocery listing surface shares.
 *
 * The backend is the only authority on serviceability: when it reports the
 * delivery location is outside the served area — or inside a zone where Grocery
 * is switched off — stores, categories, products, carousels and grocery search
 * results are replaced by this state. They must never fall back to an
 * unfiltered list, and the client never derives the zone itself.
 *
 * This is the Grocery twin of the Food notice, with its own copy so Food
 * surfaces keep rendering exactly what they always have.
 */
export function GroceryServiceabilityNotice({
  serviceability,
  onChangeLocation,
  className,
}: GroceryServiceabilityNoticeProps) {
  if (!serviceability || serviceability.is_serviceable) return null;

  const groceryDisabled = serviceability.reason === 'SERVICE_NOT_AVAILABLE_IN_ZONE';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-8 py-14 text-center animate-fade-in',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-grocery-50 text-grocery-600">
        <MapPinOff className="h-8 w-8" />
      </div>
      <div className="max-w-md">
        {/* The required unavailable-location message, shown for every reason the
            backend reports (outside coverage, invalid/missing coordinates or
            Grocery switched off inside the zone). */}
        <h3 className="text-base font-semibold text-neutral-900">We're not serving your location yet</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {groceryDisabled
            ? 'Grocery isn’t switched on at this delivery address yet. Try another delivery address to discover stores available in your area.'
            : "We're expanding our delivery coverage. Try another delivery address to discover stores available in your area."}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onChangeLocation}>
        Change location
      </Button>
    </div>
  );
}
