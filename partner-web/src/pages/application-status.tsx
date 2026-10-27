import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarTaxiFront, Bike, LogOut, RefreshCw, Hourglass } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/repositories/auth';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: 'Application under review',
    body: 'Our team is verifying your documents. This usually takes up to 24 hours — you will be able to start working as soon as your profile is approved.',
  },
  rejected: {
    title: 'Application not approved',
    body: 'Your application was not approved. Update the details below and resubmit, or contact support for help.',
  },
  suspended: {
    title: 'Account suspended',
    body: 'Your account has been suspended. Contact support to resolve this before you can go online.',
  },
};

export function ApplicationStatusPage() {
  const navigate = useNavigate();
  const { profile, role, user } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const status = profile?.status ?? 'pending';
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const copy = STATUS_COPY[key] ?? STATUS_COPY.pending;
  const isRejected = key === 'rejected';
  const BrandIcon = role === 'driver' ? CarTaxiFront : Bike;

  const reapply = async () => {
    setBusy(true);
    try {
      await authApi.reapply({});
      await useAuthStore.getState().refreshProfile();
      toast('Application resubmitted for review.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Resubmit failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    useAuthStore.getState().logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-10">
      <div className={cn('w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 shadow-card', role === 'driver' ? 'p-driver' : 'p-delivery')}>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <BrandIcon className="h-7 w-7" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-2">
          <StatusBadge status={status === 'on_delivery' ? 'offline' : status} />
        </div>
        <h1 className="mb-2 text-center text-xl font-black text-neutral-900">{copy.title}</h1>
        <p className="mb-5 text-center text-sm leading-relaxed text-neutral-500">{copy.body}</p>

        {isRejected && profile?.rejection_reason && (
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Reason</p>
            <p className="text-sm text-red-800">{profile.rejection_reason}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isRejected && (
            <Button className="w-full" disabled={busy} onClick={() => void reapply()}>
              <RefreshCw className="h-4 w-4" />
              {busy ? 'Resubmitting…' : 'Resubmit application'}
            </Button>
          )}
          {key === 'pending' && (
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-neutral-500">
              <Hourglass className="h-4 w-4" /> We&apos;ll notify you here once reviewed
            </div>
          )}
          <Button variant="ghost" className="w-full text-red-600" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        {user && (
          <p className="mt-6 text-center text-xs text-neutral-400">
            Signed in as {user.name} ({user.email ?? user.phone})
          </p>
        )}
      </div>
    </div>
  );
}