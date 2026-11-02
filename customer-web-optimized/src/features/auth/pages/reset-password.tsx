import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { toast } from '@/shared/components/ui/toast';

const INVALID_LINK_MESSAGE = 'This password reset link is invalid or has expired.';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  // Read straight from the URL. The token is deliberately never mirrored into
  // component state beyond the field that must submit it, and is not logged.
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // Derived from the URL rather than stored, so the link cannot drift out of
  // sync with the query string.
  const linkError = !token || !email ? INVALID_LINK_MESSAGE : null;

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (linkError) return;

    if (password.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      toast('The password confirmation does not match.', 'error');
      return;
    }

    setPending(true);
    try {
      await resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirm,
      });
      setDone(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : INVALID_LINK_MESSAGE, 'error');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Password updated</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Your password has been reset successfully. You can now sign in with your new
            password.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/auth/login', { replace: true })}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Choose a new password</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {linkError ? INVALID_LINK_MESSAGE : `Resetting password for ${email}`}
          </p>
        </div>

        <Card className="p-4">
          {linkError ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{linkError}</p>
              <Button type="button" variant="secondary" className="w-full" onClick={() => navigate('/auth/forgot-password')}>
                Request a new link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="New Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Re-enter your new password"
              />
              {mismatch && (
                <p className="text-xs font-medium text-red-600">
                  The password confirmation does not match.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending || mismatch}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          )}

          <div className="mt-4 border-t border-neutral-100 pt-4 text-center">
            <Link
              to="/auth/login"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Back to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
