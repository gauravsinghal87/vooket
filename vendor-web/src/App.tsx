import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/guards/require-auth';
import { RequireApproved } from '@/components/guards/require-approved';
import { ImpersonationHandoff } from '@/components/guards/impersonation-handoff';
import { Shell } from '@/components/layout/Shell';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { DashboardPage } from '@/pages/dashboard';
import { OrdersPage } from '@/pages/orders';
import { OutletsPage } from '@/pages/outlets';
import { DeliverySlotsPage } from '@/pages/delivery-slots';
import { ProductsPage } from '@/pages/products';
import { CategoriesPage } from '@/pages/categories';
import { CouponsPage } from '@/pages/coupons';
import { EarningsPage } from '@/pages/earnings';
import { ProfilePage } from '@/pages/profile';
import { NotFoundPage } from '@/pages/not-found';

export default function App() {
  return (
    <>
      {/* Handles the admin handoff code before the auth guard runs, so a fresh
          tab opened by the admin can authenticate itself. */}
      <ImpersonationHandoff />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireApproved />}>
          <Route element={<Shell />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="outlets" element={<OutletsPage />} />
            <Route path="delivery-slots" element={<DeliverySlotsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
    </>
  );
}