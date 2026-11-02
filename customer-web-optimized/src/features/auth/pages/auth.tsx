import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Smartphone } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useAppConfig } from '@/shared/hooks/useBranding';
import { BrandLogo } from '@/shared/components/brand/brand-logo';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { toast } from '@/shared/components/ui/toast';
import {
  GoogleSignInButton,
  GoogleSignInDivider,
} from '@/features/auth/components/google-sign-in-button';
import { cn } from '@/shared/utils/utils';

type Mode = 'login' | 'register' | 'otp';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';

  const [mode, setMode] = useState<Mode>(() => (location.pathname === '/auth/register' ? 'register' : 'login'));
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState(false);

  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const loginWithPhone = useAuthStore((s) => s.loginWithPhone);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const register = useAuthStore((s) => s.register);
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const sendOtp = useAuthStore((s) => s.sendOtp);

  const { data: appConfig } = useAppConfig();

  const googleClientId = appConfig?.google?.enabled === true ? appConfig.google.client_id : null;

  const finish = () => {
    toast('Welcome!');
    navigate(redirectTo, { replace: true });
  };

  const handleGoogleCredential = async (credential: string) => {
    setPending(true);
    try {
      await loginWithGoogle(credential);
      finish();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.', 'error');
    } finally {
      setPending(false);
    }
  };

  const googleButton = (context: 'signin' | 'signup') => {
    if (!googleClientId) return null;

    return (
      <>
        <GoogleSignInDivider />
        <GoogleSignInButton
          clientId={googleClientId}
          context={context}
          text="continue"
          disabled={pending}
          onCredential={handleGoogleCredential}
          onError={(message) => toast(message, 'error')}
        />
      </>
    );
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setOtp('');
    setOtpSent(false);
    setPassword('');
    setPasswordConfirm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register' && password !== passwordConfirm) {
      toast('Passwords do not match.', 'error');
      return;
    }

    setPending(true);
    try {
      if (mode === 'login') {
        const id = identifier.trim();
        if (id.includes('@')) {
          await loginWithEmail(id, password);
        } else {
          await loginWithPhone(id.replace(/[\s-]/g, ''), password);
        }
      } else if (mode === 'register') {
        await register({
          name,
          phone,
          email: email || undefined,
          password,
          password_confirmation: passwordConfirm,
        });
      } else {
        await loginWithOtp(phone, otp);
      }
      finish();
    } catch {
      toast('Authentication failed. Please try again.', 'error');
    } finally {
      setPending(false);
    }
  };

  const requestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim()) {
      toast('Enter your phone number first.', 'error');
      return;
    }
    setPending(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      toast('OTP sent to +91 ' + phone);
    } catch {
      toast('Could not send OTP. Please try again.', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          {mode === 'login' && (
            <>
              <h1 className="text-2xl font-extrabold text-neutral-900">Welcome back</h1>
              <p className="mt-1 text-sm text-neutral-500">Sign in to continue to your orders & wallet.</p>
            </>
          )}
          {mode === 'register' && (
            <>
              <h1 className="text-2xl font-extrabold text-neutral-900">Create your account</h1>
              <p className="mt-1 text-sm text-neutral-500">Order food, groceries and rides with one account.</p>
            </>
          )}
          {mode === 'otp' && (
            <>
              <h1 className="text-2xl font-extrabold text-neutral-900">Verify your number</h1>
              <p className="mt-1 text-sm text-neutral-500">We sent an OTP to +91 {phone || 'your phone'}.</p>
            </>
          )}
        </div>

        <Card className="p-4">
          {mode !== 'otp' && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    'rounded-lg py-2 text-sm font-semibold transition-colors',
                    mode === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  )}
                >
                  {m === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Email or phone"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or 9876543210"
              />
              <Input
                label="Password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <div className="flex justify-end">
                <Link
                  to="/auth/forgot-password"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Forgot Password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              {googleButton('signin')}
              <button
                type="button"
                onClick={() => switchMode('otp')}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                <Smartphone className="h-4 w-4" /> Continue with phone OTP
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Full name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
              <Input label="Phone" required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com (optional)" />
              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Input
                label="Confirm password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Re-enter your password"
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
              {googleButton('signup')}
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              <Button type="button" variant="secondary" className="w-full" disabled={pending || !phone.trim()} onClick={() => requestOtp()}>
                {pending && !otpSent && <Loader2 className="h-4 w-4 animate-spin" />}
                {otpSent ? 'OTP sent — resend?' : 'Send OTP'}
              </Button>
              <Input
                label="OTP"
                inputMode="numeric"
                required
                maxLength={6}
                disabled={!otpSent}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
              />
              <Button
                type="submit"
                className="w-full"
                disabled={!otpSent || otp.length !== 6 || pending}
              >
                {pending && otpSent && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & continue
              </Button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
              >
                Back to sign in
              </button>
            </form>
          )}
        </Card>

        <p className="mt-5 text-center text-xs text-neutral-500">
          By continuing you agree to our{' '}
          <button className="font-semibold text-brand-600 underline underline-offset-2" onClick={() => toast('Terms will open soon')}>
            Terms
          </button>{' '}
          &{' '}
          <button className="font-semibold text-brand-600 underline underline-offset-2" onClick={() => toast('Privacy policy will open soon')}>
            Privacy policy
          </button>
          .
        </p>
        <p className="mt-3 text-center text-xs text-neutral-400">
          Demo mode: any credentials work. <Link to="/food" className="text-brand-600 underline underline-offset-2">Browse food</Link>
        </p>
      </div>
    </div>
  );
}