import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { ApiError } from '@/api/client';
import { IS_MOCK } from '@/config/dataSource';
import { BrandLogo } from '@/components/BrandLogo';
import { useAppConfig } from '@/hooks/useBranding';
import { GoogleSignInButton, GoogleSignInDivider } from '@/components/auth/GoogleSignInButton';
import { colors } from '@/theme';

export type AuthMode = 'login' | 'register' | 'otp';

const routeFor = (mode: AuthMode) => (mode === 'login' ? '/auth/login' : mode === 'register' ? '/auth/register' : '/auth/otp');

/**
 * customer-web keeps one <AuthPage> mounted and swaps `mode` in place, so what
 * the customer already typed (name, phone, email) survives a switch. Mobile
 * remounts the screen when the mode changes — that keeps the URL in step with
 * the mode, the way react-router does on the web — so the fields worth keeping
 * are parked here and restored on mount. Passwords and the OTP are deliberately
 * not kept: web's `switchMode` clears them too.
 */
const draft = { identifier: '', name: '', phone: '', email: '' };

const clearDraft = () => {
  draft.identifier = '';
  draft.name = '';
  draft.phone = '';
  draft.email = '';
};

/** Real server wording when there is one, the web app's copy when there isn't. */
const serverMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const first = error.errors ? Object.values(error.errors).flat()[0] : undefined;
    if (first) return first;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const loginWithPhone = useAuthStore((s) => s.loginWithPhone);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const register = useAuthStore((s) => s.register);
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const sendOtp = useAuthStore((s) => s.sendOtp);

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [identifier, setIdentifier] = useState(draft.identifier);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phone, setPhone] = useState(draft.phone);
  const [name, setName] = useState(draft.name);
  const [email, setEmail] = useState(draft.email);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState(false);

  // Field setters that mirror what is typed into the draft, so it survives the
  // remount a mode switch causes.
  const updateIdentifier = (value: string) => {
    draft.identifier = value;
    setIdentifier(value);
  };
  const updatePhone = (value: string) => {
    draft.phone = value;
    setPhone(value);
  };
  const updateName = (value: string) => {
    draft.name = value;
    setName(value);
  };
  const updateEmail = (value: string) => {
    draft.email = value;
    setEmail(value);
  };

  const { data: appConfig } = useAppConfig();

  const googleClientId = appConfig?.google?.enabled === true ? appConfig.google.client_id : null;

  // Same `?redirect=` contract as customer-web's RequireAuth.
  const redirectTo = typeof params.redirect === 'string' && params.redirect.startsWith('/') ? params.redirect : '/';

  const finish = () => {
    toast('Welcome!');
    clearDraft();
    router.replace(redirectTo as never);
  };

  /**
   * customer-web swaps `mode` without leaving the page; here the equivalent is
   * replacing the route so the URL always names the mode on screen, with the
   * draft keeping what was already typed. Password and OTP state reset on the
   * way, exactly like web's `switchMode`.
   */
  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    router.replace(routeFor(next) as never);
  };

  const handleGoogleCredential = async (credential: string) => {
    setPending(true);
    try {
      await loginWithGoogle(credential);
      finish();
    } catch (error) {
      toast(serverMessage(error, 'Google sign-in failed. Please try again.'), 'error');
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
          disabled={pending}
          onCredential={handleGoogleCredential}
          onError={(message) => toast(message, 'error')}
        />
      </>
    );
  };

  const handleSubmit = async () => {
    if (mode === 'login') {
      if (!identifier.trim()) {
        toast('Enter your email or phone.', 'error');
        return;
      }
      if (!password) {
        toast('Enter your password.', 'error');
        return;
      }
    }

    if (mode === 'register') {
      if (!name.trim()) {
        toast('Enter your full name.', 'error');
        return;
      }
      if (!phone.trim()) {
        toast('Enter your phone number.', 'error');
        return;
      }
      if (!password || password.length < 8 || passwordConfirm.length < 8) {
        toast('Password must be at least 8 characters.', 'error');
        return;
      }
      if (password !== passwordConfirm) {
        toast('Passwords do not match.', 'error');
        return;
      }
    }

    if (mode === 'otp' && otp.length !== 6) {
      toast('Enter the 6-digit OTP.', 'error');
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
    } catch (error) {
      toast(serverMessage(error, 'Authentication failed. Please try again.'), 'error');
    } finally {
      setPending(false);
    }
  };

  const requestOtp = async () => {
    if (!phone.trim()) {
      toast('Enter your phone number first.', 'error');
      return;
    }
    setPending(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      toast('OTP sent to +91 ' + phone);
    } catch (error) {
      toast(serverMessage(error, 'Could not send OTP. Please try again.'), 'error');
    } finally {
      setPending(false);
    }
  };

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'register'
        ? 'Create your account'
        : 'Verify your number';
  const subtitle =
    mode === 'login'
      ? 'Sign in to continue to your orders & wallet.'
      : mode === 'register'
        ? 'Order food, groceries and rides with one account.'
        : `We sent an OTP to +91 ${phone || 'your phone'}.`;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <BrandLogo size="lg" showText />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {mode !== 'otp' && (
          <View style={styles.segment}>
            {(['login', 'register'] as const).map((m) => (
              <Pressable key={m} style={[styles.segmentItem, mode === m && styles.segmentActive]} onPress={() => switchMode(m)}>
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'login' ? 'Sign in' : 'Sign up'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.card}>
          {mode === 'login' && (
            <View style={styles.form}>
              <Text style={styles.label}>Email or phone</Text>
              <TextInput
                value={identifier}
                onChangeText={updateIdentifier}
                placeholder="you@example.com or 9876543210"
                placeholderTextColor={colors.neutral[400]}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={colors.neutral[400]}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="password"
                textContentType="password"
              />
              <Pressable style={styles.forgotRow} onPress={() => router.push('/auth/forgot' as never)} hitSlop={6}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
              <Pressable style={[styles.primary, pending && { opacity: 0.6 }]} onPress={handleSubmit} disabled={pending}>
                {pending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Sign in</Text>}
              </Pressable>
              {googleButton('signin')}
              <Pressable style={styles.otpLink} onPress={() => switchMode('otp')}>
                <Smartphone size={16} color={colors.brand[700]} />
                <Text style={styles.otpLinkText}>Continue with phone OTP</Text>
              </Pressable>
            </View>
          )}

          {mode === 'register' && (
            <View style={styles.form}>
              <Text style={styles.label}>Full name</Text>
              <TextInput value={name} onChangeText={updateName} placeholder="Aarav Sharma" placeholderTextColor={colors.neutral[400]} style={styles.input} />
              <Text style={styles.label}>Phone</Text>
              <TextInput value={phone} onChangeText={updatePhone} placeholder="9876543210" placeholderTextColor={colors.neutral[400]} style={styles.input} keyboardType="phone-pad" />
              <Text style={styles.label}>Email</Text>
              <TextInput value={email} onChangeText={updateEmail} placeholder="you@example.com (optional)" placeholderTextColor={colors.neutral[400]} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Text style={styles.label}>Password</Text>
              <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={colors.neutral[400]} style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="new-password" textContentType="newPassword" />
              <Text style={styles.label}>Confirm password</Text>
              <TextInput value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="Re-enter your password" placeholderTextColor={colors.neutral[400]} style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="new-password" textContentType="newPassword" />
              <Pressable style={[styles.primary, pending && { opacity: 0.6 }]} onPress={handleSubmit} disabled={pending}>
                {pending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Create account</Text>}
              </Pressable>
              {googleButton('signup')}
            </View>
          )}

          {mode === 'otp' && (
            <View style={styles.form}>
              <Text style={styles.label}>Phone</Text>
              <TextInput value={phone} onChangeText={updatePhone} placeholder="9876543210" placeholderTextColor={colors.neutral[400]} style={styles.input} keyboardType="phone-pad" />
              <Pressable style={[styles.secondary, (pending || !phone.trim()) && { opacity: 0.6 }]} onPress={requestOtp} disabled={pending || !phone.trim()}>
                {pending && !otpSent ? <ActivityIndicator color={colors.ink[900]} size="small" /> : <Text style={styles.secondaryText}>{otpSent ? 'OTP sent — resend?' : 'Send OTP'}</Text>}
              </Pressable>
              <Text style={styles.label}>OTP</Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor={colors.neutral[400]}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                editable={otpSent}
              />
              <Pressable style={[styles.primary, (!otpSent || otp.length !== 6 || pending) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!otpSent || otp.length !== 6 || pending}>
                {pending && otpSent ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Verify & continue</Text>}
              </Pressable>
              <Pressable style={styles.backToLogin} onPress={() => switchMode('login')}>
                <Text style={styles.backToLoginText}>Back to sign in</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.terms}>
          By continuing you agree to our{' '}
          <Text style={styles.termsLink} onPress={() => toast('Terms will open soon')}>Terms</Text>
          {'\u00A0'}&{'\u00A0'}
          <Text style={styles.termsLink} onPress={() => toast('Privacy policy will open soon')}>Privacy policy</Text>.
        </Text>
        {IS_MOCK && (
          <Text style={styles.demo}>
            Demo mode: any credentials work.{' '}
            <Text style={styles.termsLink} onPress={() => router.replace('/' as never)}>
              Take me home
            </Text>
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: '#f7f6f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    paddingVertical: 40,
  },
  inner: {
    width: '100%',
    maxWidth: 420,
  },
  head: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink[900],
    marginTop: 14,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 4,
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: colors.neutral[100],
    padding: 4,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#fff',
    shadowColor: colors.ink[900],
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  segmentTextActive: {
    color: colors.ink[900],
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 16,
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink[800],
    marginTop: 2,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.ink[900],
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    marginTop: 4,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.ink[50],
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  otpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
  },
  otpLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  backToLoginText: {
    fontSize: 14,
    color: colors.neutral[500],
    textDecorationLine: 'underline',
  },
  terms: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 20,
  },
  termsLink: {
    fontWeight: '700',
    color: colors.brand[700],
    textDecorationLine: 'underline',
  },
  demo: {
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: 10,
  },
});