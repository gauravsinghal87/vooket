import type { ServiceType } from '@/shared/types/models';

/**
 * Module chunk prefetch.
 *
 * The dock switcher calls this on pointer-enter/focus, so the destination
 * module's JS is already in the browser cache by the time the click lands.
 * Vite deduplicates the dynamic import with the route's lazy import, so this
 * warms the exact same chunk instead of downloading it twice.
 */
const loaders: Record<ServiceType, () => Promise<unknown>> = {
  food: () => import('@/modules/food/pages/food'),
  grocery: () => import('@/modules/grocery/pages/grocery'),
  rides: () => import('@/modules/rides/pages/rides'),
};

export function prefetchModule(service: ServiceType): void {
  void loaders[service]?.().catch(() => {
    // A failed prefetch is harmless: navigation's lazy import retries it.
  });
}
