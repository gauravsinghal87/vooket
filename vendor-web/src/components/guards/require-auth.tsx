import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

export function RequireAuth() {
  const { initialized, isAuthenticated } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) void useAuthStore.getState().initialize();
  }, [initialized]);

  if (!initialized) {
    return (
      <div className={cn('flex min-h-dvh items-center justify-center bg-ink-50')}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading vendor hub…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}