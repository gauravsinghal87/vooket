import { Star, StarHalf } from 'lucide-react';
import { cn, ratingLabel } from '@/shared/utils/utils';

interface RatingProps {
  value: string | number | null | undefined;
  count?: number;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}

export function Rating({ value, count, size = 'sm', align = 'left' }: RatingProps) {
  const numeric = parseFloat(String(value ?? ''));
  const hasValue = !Number.isNaN(numeric) && numeric > 0;
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (!hasValue) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-neutral-500', align === 'right' && 'flex-row-reverse')}>
        <span>{count ? `${count} ratings` : 'New'}</span>
      </span>
    );
  }

  const full = Math.floor(numeric);
  const half = numeric - full >= 0.5;

  return (
    <span
      className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}
      aria-label={`Rated ${ratingLabel(value)} out of 5`}
    >
      <span className="inline-flex items-center gap-0.5 text-success">
        <span className="flex items-center">
          {Array.from({ length: full }).map((_, i) => (
            <Star key={i} className={cn(starSize, 'fill-current')} />
          ))}
          {half && <StarHalf className={cn(starSize, 'fill-current')} />}
        </span>
        <span className={cn('font-semibold', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {ratingLabel(value)}
        </span>
      </span>
      {count !== undefined && <span className="text-xs text-neutral-400">({count})</span>}
    </span>
  );
}
