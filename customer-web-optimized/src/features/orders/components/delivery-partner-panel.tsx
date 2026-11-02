import { Phone, UserCircle2 } from 'lucide-react';
import { formatDistance, formatEta, hasLiveLocation } from '@/shared/utils/orderTracking';
import { cn } from '@/shared/utils/utils';
import type { OrderTracking } from '@/shared/types/models';

interface DeliveryPartnerPanelProps {
  tracking: OrderTracking;
  tone: 'brand' | 'food' | 'grocery';
}

/**
 * Mask the middle of a vehicle registration so the full plate is never exposed
 * in the client UI (e.g. `DL01AB1234` -> `DL••••1234`). Falls back to the raw
 * value for anything too short to mask meaningfully.
 */
function maskVehicle(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) return value;
  return `${compact.slice(0, 2)}••••${compact.slice(-2)}`;
}

/**
 * Compact delivery-partner panel shown directly below the live map. Only
 * rendered when a partner is actually assigned (caller guards this). Uses the
 * real dispatch payload — never fabricates a partner, phone or location.
 */
export function DeliveryPartnerPanel({ tracking, tone }: DeliveryPartnerPanelProps) {
  const partner = tracking.partner;
  if (!partner) return null;

  const partnerPhone = partner.phone?.trim() || null;
  const live = hasLiveLocation(tracking);
  const stale = tracking.tracking?.location_stale === true;
  const distance = formatDistance(tracking.route?.distance_km ?? null);
  const eta = formatEta(tracking.eta);
  const food = tone === 'food';
  const grocery = tone === 'grocery';

  const vehicle = partner.vehicle_number
    ? `${partner.vehicle_type ? `${partner.vehicle_type} · ` : ''}${maskVehicle(partner.vehicle_number)}`
    : partner.vehicle_type ?? 'Delivery partner';

  return (
    <div className="mx-auto w-full max-w-2xl px-[var(--page-gutter)] pt-3">
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3.5">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full',
            food ? 'bg-food-100 text-food-700' : grocery ? 'bg-grocery-100 text-grocery-800' : 'bg-brand-100 text-brand-700'
          )}
        >
          {partner.photo ? (
            <img src={partner.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserCircle2 className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neutral-900">{partner.name}</p>
          <p className="truncate text-xs text-neutral-500">{vehicle}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            {live && !stale ? (
              <span className="flex items-center gap-1 font-semibold text-success">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                Live
              </span>
            ) : (
              <span className="font-medium text-neutral-400">{stale ? 'Location paused' : 'Location updating'}</span>
            )}
            {distance && <span className="font-medium text-neutral-500">· {distance} away</span>}
            {eta && <span className="font-medium text-neutral-500">· {eta}</span>}
          </div>
        </div>

        {partnerPhone && (
          <a
            href={`tel:${partnerPhone.replace(/[^+\d]/g, '')}`}
            aria-label={`Call ${partner.name}`}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90',
              food ? 'bg-food-600 text-white' : grocery ? 'bg-grocery-500 text-ink-900' : 'bg-brand-600 text-white'
            )}
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
