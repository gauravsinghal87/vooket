import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/guards/require-auth';
import { RequireApproved } from '@/components/guards/require-approved';
import { Shell } from '@/components/layout/Shell';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { DashboardPage } from '@/pages/dashboard';
import { RequestsPage } from '@/pages/requests';
import { EarningsPage } from '@/pages/earnings';
import { WalletPage } from '@/pages/wallet';
import { ProfilePage } from '@/pages/profile';
import { NotFoundPage } from '@/pages/not-found';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireApproved />}>
          <Route element={<Shell />}>
            <Route index element={<DashboardPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}