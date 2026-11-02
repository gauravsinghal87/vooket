import { Route } from 'react-router-dom';
import { AuthPage } from '@/features/auth/pages/auth';
import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password';
import { ResetPasswordPage } from '@/features/auth/pages/reset-password';

/** Authentication owns the unauthenticated URL contract. */
export const authRoutes = (
  <>
    <Route path="auth/login" element={<AuthPage />} />
    <Route path="auth/register" element={<AuthPage />} />
    <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="auth/reset-password" element={<ResetPasswordPage />} />
  </>
);
