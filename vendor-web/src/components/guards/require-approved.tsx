import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ApplicationStatusPage } from '@/pages/application-status';

const BLOCKED = new Set(['pending', 'rejected', 'suspended']);

export function RequireApproved() {
  const status = useAuthStore((s) => s.profile?.vendor?.status);

  if (!status || BLOCKED.has(status.toLowerCase().replace(/\s+/g, '_'))) {
    return <ApplicationStatusPage />;
  }

  return <Outlet />;
}