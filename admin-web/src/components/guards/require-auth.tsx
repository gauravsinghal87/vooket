import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { LoadingState } from '@/components/ui/state';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { initialized, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!initialized) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}