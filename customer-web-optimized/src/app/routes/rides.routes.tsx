import { Route } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { RidesPage } from '@/modules/rides/pages/rides';
import { RidesDestinationPage } from '@/modules/rides/pages/rides-destination';
import { RideConfirmPickupPage } from '@/modules/rides/pages/ride-confirm-pickup';
import { RideDetailPage } from '@/modules/rides/pages/ride-detail';

/**
 * Rides owns its home, destination picker, pickup confirmation and ride detail.
 * Every rides route stays under the module and uses its own components/services.
 */
export const ridesRoutes = (
  <>
    <Route path="rides" element={<RidesPage />} />
    <Route path="rides/destination" element={<RidesDestinationPage />} />
    <Route
      path="rides/confirm-pickup"
      element={
        <RequireAuth>
          <RideConfirmPickupPage />
        </RequireAuth>
      }
    />
    <Route
      path="ride/:id"
      element={
        <RequireAuth>
          <RideDetailPage />
        </RequireAuth>
      }
    />
  </>
);
