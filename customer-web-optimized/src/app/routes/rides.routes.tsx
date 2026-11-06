import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { PageFallback } from '@/shared/components/ui/page-fallback';

/**
 * Rides owns its home, destination picker, pickup confirmation and ride detail.
 * Every rides route stays under the module and uses its own components/services.
 *
 * The Rides screens (and the Google Maps loader they pull in) are isolated in
 * their own chunks, so Food and Grocery never pay for the map bundle.
 */
const RidesPage = lazy(() =>
  import('@/modules/rides/pages/rides').then((m) => ({ default: m.RidesPage }))
);
const RidesDestinationPage = lazy(() =>
  import('@/modules/rides/pages/rides-destination').then((m) => ({ default: m.RidesDestinationPage }))
);
const RideConfirmPickupPage = lazy(() =>
  import('@/modules/rides/pages/ride-confirm-pickup').then((m) => ({ default: m.RideConfirmPickupPage }))
);
const RideDetailPage = lazy(() =>
  import('@/modules/rides/pages/ride-detail').then((m) => ({ default: m.RideDetailPage }))
);

const page = (element: ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

export const ridesRoutes = (
  <>
    <Route path="rides" element={page(<RidesPage />)} />
    <Route path="rides/destination" element={page(<RidesDestinationPage />)} />
    <Route
      path="rides/confirm-pickup"
      element={page(
        <RequireAuth>
          <RideConfirmPickupPage />
        </RequireAuth>
      )}
    />
    <Route
      path="ride/:id"
      element={page(
        <RequireAuth>
          <RideDetailPage />
        </RequireAuth>
      )}
    />
  </>
);
