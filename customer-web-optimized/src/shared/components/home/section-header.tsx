import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  to?: string;
  actionLabel?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function SectionHeader({ title, subtitle, to, actionLabel = 'See all', Icon, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-neutral-900 sm:text-lg">
          {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-accent-500" />}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-neutral-500 transition-colors hover:text-ink-900"
        >
          {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

interface RailProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Rail({ children, className, id }: RailProps) {
  return (
    <div
      id={id}
      className={cn(
        'edge-bleed -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar scroll-snap-x',
        className
      )}
    >
      {children}
    </div>
  );
}