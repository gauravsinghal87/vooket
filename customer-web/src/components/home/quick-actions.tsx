import { ArrowRight, UtensilsCrossed, ShoppingBasket, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ServiceType } from '@/types/models';
import { SERVICE_THEMES, SERVICE_ROUTES } from '@/components/service/service-theme';
import { cn } from '@/lib/utils';

interface QuickAction {
  service: ServiceType;
  tag: string;
  desc: string;
  cta: string;
}

const ACTIONS: (QuickAction & { icon: typeof UtensilsCrossed })[] = [
  { service: 'food', tag: '30 min', desc: 'Meals from top restaurants', cta: 'Order food', icon: UtensilsCrossed },
  { service: 'grocery', tag: '15 min', desc: 'Daily essentials, fast', cta: 'Shop now', icon: ShoppingBasket },
  { service: 'rides', tag: '5 min', desc: 'Anywhere, in minutes', cta: 'Book a ride', icon: Car },
];

export function QuickActions() {
  return (
    <section
      aria-label="Services"
      className="flex flex-nowrap gap-3 overflow-x-auto pb-1 scroll-smooth no-scrollbar"
    >
      {ACTIONS.map(({ service, tag, desc, cta, icon }) => {
        const theme = SERVICE_THEMES[service];
        const Icon = theme.icon;
        const IconBg = icon;
        return (
          <Link
            key={service}
            to={SERVICE_ROUTES[service]}
            className={cn(
              // flex-1 keeps the three cards equal and filling the row on wide
              // screens; min-w stops them being squeezed below a readable
              // width, so the row scrolls sideways instead of stacking.
              'group relative min-w-[140px] flex-1 overflow-hidden rounded-3xl bg-gradient-to-br p-4 pr-5 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:scale-[0.99]',
              theme.gradient
            )}
          >
            <span className="absolute -right-4 -top-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/10 blur-[1px]">
              <IconBg className="h-12 w-12 -translate-x-4 translate-y-4 text-white/25 transition-transform duration-500 group-hover:scale-110" />
            </span>

            <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', theme.solid)}>
              <Icon className="h-5 w-5" />
            </span>

            <p className="mt-3 text-lg font-extrabold leading-none">{theme.label}</p>
            <p className="mt-1 text-[12px] leading-snug text-white/80">{desc}</p>

            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur">
                {tag}
              </span>
              <span className="inline-flex items-center gap-0.5 opacity-90 transition-all group-hover:gap-1.5 group-hover:opacity-100">
                {cta} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}