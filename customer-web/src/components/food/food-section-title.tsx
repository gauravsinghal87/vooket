import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Food home's section heading, matching the reference `.section-title`:
 * a small, wide-tracked, muted uppercase line above each block
 * ("RECOMMENDED FOR YOU", "IN THE SPOTLIGHT", "EXPLORE MORE",
 * "1463 RESTAURANTS DELIVERING TO YOU").
 *
 * Deliberately not the shared `SectionHeader`: the Food home has no "See all"
 * action next to these titles in the reference, and its heading treatment
 * (14px, 0.25em tracking, neutral-500) differs from the bold dark titles the
 * other pages use. `children` is rendered verbatim — callers pass the copy
 * already uppercased, exactly as the reference does.
 */
export function FoodSectionTitle({
  children,
  subtitle,
  id,
  className,
}: {
  children: ReactNode;
  /** Secondary line under the title (e.g. "Featured"). */
  subtitle?: ReactNode;
  /** id for the section's `aria-labelledby`. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('pb-4', className)}>
      <h2 id={id} className="text-sm font-medium tracking-[0.25em] text-neutral-500">{children}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}
