import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MailCheck, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { toast } from '@/shared/stores/toastStore';
import { colors } from '@/shared/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast('Enter your email address.', 'error');
      return;
    }
    setPending(true);
    try {
      const message = await forgotPassword(email.trim());
      setSentMessage(message);
    } catch (error) {
      toast(error instanceof Error ? error.message : "We couldn't send the reset email right now. Please try again later.", 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <View style={styles.logo}>
            {sentMessage ? <MailCheck size={28} color="#fff" /> : <ShieldCheck size={28} color="#fff" />}
          </View>
          <Text style={styles.title}>{sentMessage ? 'Check your email' : 'Forgot your password?'}</Text>
          <Text style={styles.subtitle}>
            {sentMessage
              ? 'If a reset link was sent, it will arrive shortly.'
              : "Enter your email and we'll send you a link to choose a new one."}
          </Text>
        </View>

        <View style={styles.card}>
          {sentMessage ? (
            <View style={styles.form}>
              <Text style={styles.sentMessage}>{sentMessage}</Text>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  setSentMessage(null);
                  setEmail('');
                }}
              >
                <Text style={styles.secondaryText}>Send to a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.neutral[400]}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={[styles.primary, pending && { opacity: 0.6 }]} onPress={handleSubmit} disabled={pending}>
                {pending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Send Reset Link</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.divider}>
            <Pressable style={styles.backRow} onPress={() => router.push('/auth/login' as never)} hitSlop={6}>
              <ArrowLeft size={16} color={colors.brand[700]} />
              <Text style={styles.backText}>Back to Login</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footnote}>
          Signed up with Google or phone OTP? Continue with that method instead — those accounts don&apos;t use a password.
        </Text>
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
  sentMessage: {
    borderRadius: 14,
    backgroundColor: colors.brand[50],
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.neutral[700],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
    marginTop: 16,
    paddingTop: 14,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
  footnote: {
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: 20,
  },
});