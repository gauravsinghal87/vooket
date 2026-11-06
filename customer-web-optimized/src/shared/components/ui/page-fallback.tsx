import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Route-level Suspense fallback.
 *
 * Lazy module chunks are small and cached after the first visit; this only
 * covers the first navigation to a module while its chunk downloads. It keeps
 * the shell (header and bottom dock) mounted and reserves the page height so
 * the layout does not jump.
 */
export function PageFallback() {
  return (
    <div className="space-y-4 py-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
