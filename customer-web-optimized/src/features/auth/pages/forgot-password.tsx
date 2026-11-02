import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { toast } from '@/shared/components/ui/toast';

export function ForgotPasswordPage() {
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast('Enter your email address.', 'error');
      return;
    }

    setPending(true);
    try {
      // The server owns this wording. Showing it verbatim guarantees the page
      // cannot be read as "this account exists" or "this account does not".
      const message = await forgotPassword(email.trim());
      setSentMessage(message);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "We couldn't send the reset email right now. Please try again later.",
        'error'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            {sentMessage ? <MailCheck className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          {sentMessage ? (
            <>
              <h1 className="text-2xl font-extrabold text-neutral-900">Check your email</h1>
              <p className="mt-1 text-sm text-neutral-500">
                If a reset link was sent, it will arrive shortly.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-neutral-900">Forgot your password?</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Enter your email and we'll send you a link to choose a new one.
              </p>
            </>
          )}
        </div>

        <Card className="p-4">
          {sentMessage ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-neutral-700">
                {sentMessage}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSentMessage(null);
                  setEmail('');
                }}
              >
                Send to a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}

          <div className="mt-4 border-t border-neutral-100 pt-4">
            <Link
              to="/auth/login"
              className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </Link>
          </div>
        </Card>

        <p className="mt-5 text-center text-xs text-neutral-400">
          Signed up with Google or phone OTP? Continue with that method instead — those
          accounts don't use a password.
        </p>
      </div>
    </div>
  );
}
