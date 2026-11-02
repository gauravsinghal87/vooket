import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Skeleton } from '@/shared/components/ui/skeleton';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, initialized, initialize } = useAuthStore();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!initialized) void initialize();
  }, [initialized, initialize]);

  if (!initialized) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/auth/login?redirect=${encodeURIComponent(pathname + search)}`} replace />;
  }

  return <>{children}</>;
}