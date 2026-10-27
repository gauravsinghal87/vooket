import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/guards/require-auth';
import { Shell } from '@/components/layout/Shell';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { UsersPage } from '@/pages/users';
import { VendorsPage } from '@/pages/vendors';
import { RidersPage } from '@/pages/riders';
import { DeliveryPartnersPage } from '@/pages/delivery-partners';
import { RestaurantsPage } from '@/pages/restaurants';
import { StoresPage } from '@/pages/stores';
import { ProductsPage } from '@/pages/products';
import { CategoriesPage } from '@/pages/categories';
import { OrdersPage } from '@/pages/orders';
import { SupportTicketsPage } from '@/pages/support-tickets';
import { PayoutsPage } from '@/pages/payouts';
import { DispatchLogsPage } from '@/pages/dispatch-logs';
import { CouponsPage } from '@/pages/coupons';
import { BannersPage } from '@/pages/banners';
import { FeatureFlagsPage } from '@/pages/feature-flags';
import { RolesPage } from '@/pages/roles';
import { SettingsPage } from '@/pages/settings';
import { FareRulesPage } from '@/pages/fare-rules';
import { ZonesPage } from '@/pages/zones';
import { ZoneDeliveryConfigurationsPage } from '@/pages/zone-delivery-configurations';
import { IntegrationsPage } from '@/pages/integrations';
import { WebhooksPage } from '@/pages/webhooks';
import { NotFoundPage } from '@/pages/not-found';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/riders" element={<RidersPage />} />
        <Route path="/delivery-partners" element={<DeliveryPartnersPage />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/support-tickets" element={<SupportTicketsPage />} />
        <Route path="/payouts" element={<PayoutsPage />} />
        <Route path="/dispatch-logs" element={<DispatchLogsPage />} />
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="/feature-flags" element={<FeatureFlagsPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/fare-rules" element={<FareRulesPage />} />
        <Route path="/zones" element={<ZonesPage />} />
        <Route path="/zone-delivery-configurations" element={<ZoneDeliveryConfigurationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}