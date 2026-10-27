import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Store, Loader2, Lock, Mail, UtensilsCrossed, ShoppingBasket } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

const demoAccounts = [
  { label: 'Food · Spice Villa', email: 'restaurant@superapp.com', icon: UtensilsCrossed, className: 'text-orange-600 bg-orange-50' },
  { label: 'Grocery · FreshMart', email: 'grocery@superapp.com', icon: ShoppingBasket, className: 'text-emerald-600 bg-emerald-50' },
];

export function LoginPage() {
  const { login, isAuthenticated, initialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initialized && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
      toast('Welcome back!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-card">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">Vendor Hub</h1>
          <p className="mt-1 text-sm text-neutral-500">
            One panel for your <span className="font-semibold text-neutral-700">restaurant</span> and{' '}
            <span className="font-semibold text-neutral-700">grocery</span> business
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <Field label="Email" required>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                type="email"
                autoComplete="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </Field>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500">
          New to the platform?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            List your business — apply here
          </Link>
        </p>

        <div className="mt-5 rounded-2xl border border-ink-100 bg-white p-3 shadow-card">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Demo accounts
          </p>
          <div className="grid gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword('password');
                  setError(null);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-ink-50"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.className}`}>
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-xs text-neutral-500 font-normal">{a.email}</span>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}