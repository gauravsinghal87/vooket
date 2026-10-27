import { Link, useLocation } from 'react-router-dom';
import { Search, Mic } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { serviceTheme, activeService } from './service-theme';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  onMic?: () => void;
  /**
   * 'dark' is the translucent-on-dark treatment, 'brand' is the solid light
   * surface used on the themed top band so the field reads as a distinct
   * control, 'light' is the neutral pill used on light service headers, and
   * 'food' is the wide white rounded surface with red/pink outlined icons and
   * a divider before the microphone, used by the Food home search row.
   */
  variant?: 'dark' | 'brand' | 'light' | 'food';
}

export function SearchBar({ className, onMic, variant = 'dark' }: SearchBarProps) {
  const storedService = useAppStore((s) => s.service);
  const { pathname } = useLocation();
  // Search stays service-specific per route, falling back to the stored service
  // on `/` where no service is active.
  const service = activeService(pathname) ?? storedService;
  const theme = serviceTheme(service);
  const light = variant === 'light';
  const brand = variant === 'brand';
  const food = variant === 'food';

  return (
    <div className={cn('relative', className)}>
      <Link
        to={`/search?type=${service}`}
        className={cn(
          'group flex h-12 items-center gap-2.5 pl-4 transition-all duration-200',
          food
            ? 'rounded-xl border border-neutral-200 bg-white pr-1.5 text-sm text-neutral-500 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.35)] hover:border-neutral-300 focus-within:border-food-400'
            : light
              ? 'rounded-full border border-neutral-200 bg-neutral-50 pr-1.5 text-neutral-400 shadow-sm hover:border-neutral-300 focus-within:border-food-400'
              : brand
                ? // A solid light surface lifts the field off the blue header while
                  // the coloured mic button keeps the service accent.
                  'rounded-2xl bg-white pr-1.5 text-sm text-neutral-500 shadow-[0_6px_18px_-8px_rgb(0_0_0/0.35)] hover:bg-white/95'
                : 'rounded-2xl bg-white/10 pr-2 text-sm text-white/50 ring-1 ring-inset ring-white/20 backdrop-blur hover:bg-white/15 focus-within:ring-white/40'
        )}
        aria-label={theme.searchPlaceholder}
      >
        <Search
          strokeWidth={food ? 1.75 : 2}
          className={cn(
            'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
            food
              ? 'text-food-600'
              : light
                ? 'text-neutral-400'
                : brand
                  ? 'text-neutral-400'
                  : 'text-white/70'
          )}
        />
        <span className="min-w-0 flex-1 truncate">{theme.searchPlaceholder}</span>
        {food ? <span aria-hidden className="h-[22px] w-px shrink-0 bg-neutral-200" /> : null}
        <button
          type="button"
          aria-label="Voice search"
          onClick={(e) => {
            e.preventDefault();
            onMic?.();
          }}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-95',
            food ? 'rounded-lg' : light ? 'rounded-full' : 'rounded-xl',
            // The food field keeps its accent on the outlined mic icon with no
            // fill. The light band field takes its accent from the route's hero
            // theme, and the dark field keeps its own service solid.
            food ? 'text-food-600' : brand ? 'hero-search-accent' : !light && theme.solid
          )}
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>
      </Link>
    </div>
  );
}