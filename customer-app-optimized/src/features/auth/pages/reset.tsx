import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { toast } from '@/shared/stores/toastStore';
import { colors, withAlpha } from '@/shared/theme';

const INVALID_LINK_MESSAGE = 'This password reset link is invalid or has expired.';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const router = useRouter();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const token = useMemo(() => params.token ?? '', [params.token]);
  const email = useMemo(() => params.email ?? '', [params.email]);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const linkError = !token || !email ? INVALID_LINK_MESSAGE : null;
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async () => {
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
      await resetPassword({ token, email, password, password_confirmation: passwordConfirm });
      setDone(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : INVALID_LINK_MESSAGE, 'error');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneScreen}>
        <CheckCircle2 size={56} color={colors.emerald[500]} />
        <Text style={styles.doneTitle}>Password updated</Text>
        <Text style={styles.doneDesc}>Your password has been reset successfully. You can now sign in with your new password.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/auth/login' as never)}>
          <Text style={styles.primaryText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <View style={styles.logo}>
            <ShieldCheck size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>{linkError ? INVALID_LINK_MESSAGE : `Resetting password for ${email}`}</Text>
        </View>

        <View style={styles.card}>
          {linkError ? (
            <View style={styles.form}>
              <Text style={styles.errorBox}>{linkError}</Text>
              <Pressable style={styles.secondary} onPress={() => router.push('/auth/forgot' as never)}>
                <Text style={styles.secondaryText}>Request a new link</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>New Password</Text>
              <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={colors.neutral[400]} style={styles.input} secureTextEntry />
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="Re-enter your new password" placeholderTextColor={colors.neutral[400]} style={styles.input} secureTextEntry />
              {mismatch && <Text style={styles.mismatch}>The password confirmation does not match.</Text>}
              <Pressable style={[styles.primary, (pending || mismatch) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={pending || mismatch}>
                {pending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Reset Password</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.divider}>
            <Pressable onPress={() => router.push('/auth/login' as never)} hitSlop={6} style={styles.backRow}>
              <Text style={styles.backText}>Back to Login</Text>
            </Pressable>
          </View>
        </View>
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
  doneScreen: {
    flex: 1,
    backgroundColor: '#f7f6f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink[900],
  },
  doneDesc: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    maxWidth: 340,
  },
  inner: {
    width: '100%',
    maxWidth: 420,
  },
  head: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand[600],
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink[900],
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 4,
    textAlign: 'center',
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
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
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
  errorBox: {
    borderRadius: 14,
    backgroundColor: withAlpha(colors.warning, 0.12),
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#92400e',
  },
  mismatch: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
    marginTop: 16,
    paddingTop: 14,
  },
  backRow: {
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
});