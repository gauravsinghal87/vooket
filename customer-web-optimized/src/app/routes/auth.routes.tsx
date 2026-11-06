import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { PageFallback } from '@/shared/components/ui/page-fallback';

/** Authentication owns the unauthenticated URL contract. */
const AuthPage = lazy(() =>
  import('@/features/auth/pages/auth').then((m) => ({ default: m.AuthPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/forgot-password').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/pages/reset-password').then((m) => ({ default: m.ResetPasswordPage }))
);

const page = (element: ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

export const authRoutes = (
  <>
    <Route path="auth/login" element={page(<AuthPage />)} />
    <Route path="auth/register" element={page(<AuthPage />)} />
    <Route path="auth/forgot-password" element={page(<ForgotPasswordPage />)} />
    <Route path="auth/reset-password" element={page(<ResetPasswordPage />)} />
  </>
);
