import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CarTaxiFront, Bike, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      await useAuthStore.getState().login(email.trim(), password);
      toast('Welcome back');
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <CarTaxiFront className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-neutral-900">Partner Hub</h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in as a Driver or Delivery Partner</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
            <CarTaxiFront className="mx-auto mb-1 h-5 w-5 text-brand-600" />
            <p className="text-xs font-semibold text-neutral-800">Rides & trips</p>
            <p className="text-[11px] text-neutral-400">driver role</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
            <Bike className="mx-auto mb-1 h-5 w-5 text-brand-600" />
            <p className="text-xs font-semibold text-neutral-800">Food & grocery</p>
            <p className="text-[11px] text-neutral-400">delivery partner role</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Link to="/register" className="block text-center text-sm font-semibold text-brand-600 hover:text-brand-700">
            Want to become a partner? Apply here
          </Link>
          <p className="text-center text-[11px] leading-relaxed text-neutral-400">
            Demo accounts — driver@superapp.com / partner@superapp.com (password).
            <br />
            One account holding both roles can switch between panels.
          </p>
        </form>
      </div>
    </div>
  );
}