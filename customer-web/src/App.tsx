import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/auth/require-auth';
import { FoodPage } from '@/pages/food';
import { GroceryPage } from '@/pages/grocery';
import { RidesPage } from '@/pages/rides';
import { RidesDestinationPage } from '@/pages/rides-destination';
import { RideConfirmPickupPage } from '@/pages/ride-confirm-pickup';
import { RestaurantsPage } from '@/pages/restaurants';
import { RestaurantPage } from '@/pages/restaurant-detail';
import { StoresPage } from '@/pages/stores';
import { StorePage } from '@/pages/store-detail';
import { ProductPage } from '@/pages/product-detail';
import { SearchPage } from '@/pages/search';
import { CartRoute } from '@/pages/food-cart';
import { CheckoutPage } from '@/pages/checkout';
import { OrderConfirmationPage } from '@/pages/order-confirmation';
import { OrdersPage } from '@/pages/orders';
import { OrderDetailPage } from '@/pages/order-detail';
import { RideDetailPage } from '@/pages/ride-detail';
import { WalletPage } from '@/pages/wallet';
import { ProfilePage } from '@/pages/profile';
import { EditProfilePage } from '@/pages/edit-profile';
import { AddressesPage } from '@/pages/addresses';
import { PaymentsPage } from '@/pages/payments';
import { AuthPage } from '@/pages/auth';
import { ForgotPasswordPage } from '@/pages/forgot-password';
import { SupportTicketsPage } from '@/pages/support-tickets';
import { ResetPasswordPage } from '@/pages/reset-password';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/food" replace />} />
        <Route path="food" element={<FoodPage />} />
        <Route path="grocery" element={<GroceryPage />} />
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
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="restaurant/:id" element={<RestaurantPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="store/:id" element={<StorePage />} />
        <Route path="product/:id" element={<ProductPage />} />
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
          path="ride/:id"
          element={
            <RequireAuth>
              <RideDetailPage />
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
        {/* Module-scoped addresses: same screen, URL carries the module so the
            band, colours and back-navigation stay inside it. */}
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
        <Route path="support" element={<RequireAuth><SupportTicketsPage /></RequireAuth>} />
        <Route path="auth/login" element={<AuthPage />} />
        <Route path="auth/register" element={<AuthPage />} />
        <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/food" replace />} />
      </Route>
    </Routes>
  );
}