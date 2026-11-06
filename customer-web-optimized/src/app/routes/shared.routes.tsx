import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { PageFallback } from '@/shared/components/ui/page-fallback';

/**
 * Cross-module screens. Cart and checkout carry their module in the query
 * (`?type=food|grocery`) so a single route can serve both without duplicating
 * the URL contract. Addresses are exposed under the module-scoped aliases too,
 * preserving the existing deep links.
 *
 * Account and checkout screens are lazy: they are not needed for the first
 * module paint and their form/validation code is relatively heavy.
 */
const SearchPage = lazy(() =>
  import('@/features/search/pages/search').then((m) => ({ default: m.SearchPage }))
);
const CartRoute = lazy(() =>
  import('@/features/cart/pages/cart-route').then((m) => ({ default: m.CartRoute }))
);
const CheckoutPage = lazy(() =>
  import('@/features/checkout/pages/checkout').then((m) => ({ default: m.CheckoutPage }))
);
const OrderConfirmationPage = lazy(() =>
  import('@/features/orders/pages/order-confirmation').then((m) => ({ default: m.OrderConfirmationPage }))
);
const OrdersPage = lazy(() =>
  import('@/features/orders/pages/orders').then((m) => ({ default: m.OrdersPage }))
);
const OrderDetailPage = lazy(() =>
  import('@/features/orders/pages/order-detail').then((m) => ({ default: m.OrderDetailPage }))
);
const WalletPage = lazy(() =>
  import('@/features/wallet/pages/wallet').then((m) => ({ default: m.WalletPage }))
);
const ProfilePage = lazy(() =>
  import('@/features/profile/pages/profile').then((m) => ({ default: m.ProfilePage }))
);
const EditProfilePage = lazy(() =>
  import('@/features/profile/pages/edit-profile').then((m) => ({ default: m.EditProfilePage }))
);
const AddressesPage = lazy(() =>
  import('@/features/profile/pages/addresses').then((m) => ({ default: m.AddressesPage }))
);
const PaymentsPage = lazy(() =>
  import('@/features/payments/pages/payments').then((m) => ({ default: m.PaymentsPage }))
);
const SupportTicketsPage = lazy(() =>
  import('@/features/support/pages/support-tickets').then((m) => ({ default: m.SupportTicketsPage }))
);

const page = (element: ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;
const protectedPage = (element: ReactNode) => page(<RequireAuth>{element}</RequireAuth>);

export const sharedRoutes = (
  <>
    <Route path="search" element={page(<SearchPage />)} />
    <Route path="cart" element={page(<CartRoute />)} />
    <Route path="checkout" element={protectedPage(<CheckoutPage />)} />
    <Route path="order-confirmation/:id" element={protectedPage(<OrderConfirmationPage />)} />
    <Route path="orders" element={protectedPage(<OrdersPage />)} />
    <Route path="order/:id" element={protectedPage(<OrderDetailPage />)} />
    <Route path="wallet" element={protectedPage(<WalletPage />)} />
    <Route path="profile" element={protectedPage(<ProfilePage />)} />
    <Route path="profile/edit" element={protectedPage(<EditProfilePage />)} />
    <Route path="profile/addresses" element={protectedPage(<AddressesPage />)} />
    <Route path="food/profile/addresses" element={protectedPage(<AddressesPage />)} />
    <Route path="grocery/profile/addresses" element={protectedPage(<AddressesPage />)} />
    <Route path="profile/payments" element={protectedPage(<PaymentsPage />)} />
    <Route path="support" element={protectedPage(<SupportTicketsPage />)} />
  </>
);
