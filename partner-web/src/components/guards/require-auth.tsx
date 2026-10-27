import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function RequireAuth() {
  const { initialized, token } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) void useAuthStore.getState().initialize();
  }, [initialized]);

  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading partner hub…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}