import { useNavigate } from 'react-router-dom';
import { Copy, TicketPercent } from 'lucide-react';
import type { Offer } from '@/types/catalog';
import { Rail } from './section-header';
import { SERVICE_ROUTES, serviceTheme } from '@/components/service/service-theme';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { ServiceType } from '@/types/models';

interface PromoRailProps {
  promos: Offer[];
  className?: string;
}

export function PromoRail({ promos, className }: PromoRailProps) {
  const navigate = useNavigate();
  if (promos.length === 0) return null;

  return (
    <Rail className={className}>
      {promos.map((offer) => {
        const theme = serviceTheme(offer.service as ServiceType);
        const Icon = theme.icon;
        return (
          <button
            key={offer.id}
            onClick={() => {
              if (offer.code) {
                toast(`Code ${offer.code} copied to clipboard`);
              } else {
                navigate(SERVICE_ROUTES[offer.service as ServiceType]);
              }
            }}
            className="tap group relative w-[248px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200/60 bg-white p-3.5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:scale-[0.98]"
            aria-label={offer.title}
          >
            <span className={cn('absolute inset-y-0 left-0 w-1.5', theme.solid)} />
            <span className="flex items-center gap-2">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', theme.soft, theme.strong)}>
                <Icon className="h-4 w-4" />
              </span>
              {offer.tag && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', theme.soft, theme.strong)}>
                  {offer.tag}
                </span>
              )}
            </span>
            <p className="mt-2.5 text-[15px] font-extrabold leading-tight text-neutral-900">{offer.title}</p>
            {offer.subtitle && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-500">{offer.subtitle}</p>}
            <span className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold">
              {offer.code ? (
                <>
                  <Copy className="h-3 w-3 text-neutral-400" />
                  <span className="rounded-md border border-dashed border-neutral-300 px-1.5 py-0.5 tracking-wider text-neutral-700">
                    {offer.code}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1 text-accent-600">
                  <TicketPercent className="h-3.5 w-3.5" /> Tap to explore
                </span>
              )}
            </span>
          </button>
        );
      })}
    </Rail>
  );
}