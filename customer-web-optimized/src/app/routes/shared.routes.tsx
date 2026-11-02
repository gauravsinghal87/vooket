import { Route } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { SearchPage } from '@/features/search/pages/search';
import { CartRoute } from '@/features/cart/pages/cart-route';
import { CheckoutPage } from '@/features/checkout/pages/checkout';
import { OrderConfirmationPage } from '@/features/orders/pages/order-confirmation';
import { OrdersPage } from '@/features/orders/pages/orders';
import { OrderDetailPage } from '@/features/orders/pages/order-detail';
import { WalletPage } from '@/features/wallet/pages/wallet';
import { ProfilePage } from '@/features/profile/pages/profile';
import { EditProfilePage } from '@/features/profile/pages/edit-profile';
import { AddressesPage } from '@/features/profile/pages/addresses';
import { PaymentsPage } from '@/features/payments/pages/payments';
import { SupportTicketsPage } from '@/features/support/pages/support-tickets';

/**
 * Cross-module screens. Cart and checkout carry their module in the query
 * (`?type=food|grocery`) so a single route can serve both without duplicating
 * the URL contract. Addresses are exposed under the module-scoped aliases too,
 * preserving the existing deep links.
 */
export const sharedRoutes = (
  <>
    <Route path="search" element={<SearchPage />} />
    <Route path="cart" element={<CartRoute />} />
    <Route
      path="checkout"
      element={
        <RequireAuth>
          <CheckoutPage />
        </RequireAuth>
      }
    />
    <Route
      path="order-confirmation/:id"
      element={
        <RequireAuth>
          <OrderConfirmationPage />
        </RequireAuth>
      }
    />
    <Route
      path="orders"
      element={
        <RequireAuth>
          <OrdersPage />
        </RequireAuth>
      }
    />
    <Route
      path="order/:id"
      element={
        <RequireAuth>
          <OrderDetailPage />
        </RequireAuth>
      }
    />
    <Route
      path="wallet"
      element={
        <RequireAuth>
          <WalletPage />
        </RequireAuth>
      }
    />
    <Route
      path="profile"
      element={
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      }
    />
    <Route
      path="profile/edit"
      element={
        <RequireAuth>
          <EditProfilePage />
        </RequireAuth>
      }
    />
    <Route
      path="profile/addresses"
      element={
        <RequireAuth>
          <AddressesPage />
        </RequireAuth>
      }
    />
    <Route
      path="food/profile/addresses"
      element={
        <RequireAuth>
          <AddressesPage />
        </RequireAuth>
      }
    />
    <Route
      path="grocery/profile/addresses"
      element={
        <RequireAuth>
          <AddressesPage />
        </RequireAuth>
      }
    />
    <Route
      path="profile/payments"
      element={
        <RequireAuth>
          <PaymentsPage />
        </RequireAuth>
      }
    />
    <Route
      path="support"
      element={
        <RequireAuth>
          <SupportTicketsPage />
        </RequireAuth>
      }
    />
  </>
);
