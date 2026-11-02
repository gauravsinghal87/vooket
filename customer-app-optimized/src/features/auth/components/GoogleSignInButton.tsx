import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GOOGLE_BUILD_REQUIRED_MESSAGE, isGoogleSignInAvailable, signInWithGoogle } from '@/features/auth/services/googleAuth';
import { colors } from '@/shared/theme';

/**
 * Google's four-colour "G". Drawn from Google's published logo geometry so the
 * app carries the real brand mark without shipping an image asset (the web app
 * gets it from Google's own button renderer).
 */
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

/** Mirrors customer-web's GoogleSignInDivider. */
export function GoogleSignInDivider({ label = 'or' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

interface GoogleSignInButtonProps {
  /** Web client ID from `GET /app-config` — the audience the backend expects. */
  clientId: string;
  /** Receives the Google ID token, which the backend verifies server-side. */
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
  context?: 'signin' | 'signup';
}

export function GoogleSignInButton({ clientId, onCredential, onError, disabled = false, context = 'signin' }: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);

  // Expo Go cannot host the native SDK — same treatment customer-web gives a
  // Google script that failed to load: say so instead of showing a button that
  // cannot work. Nothing fake is ever reported as a sign-in.
  if (!isGoogleSignInAvailable()) {
    return (
      <Text style={styles.unavailable} accessibilityRole="text">
        {GOOGLE_BUILD_REQUIRED_MESSAGE}
      </Text>
    );
  }

  const handlePress = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const credential = await signInWithGoogle({
        webClientId: clientId,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? null,
      });
      await onCredential(credential);
    } catch (error) {
      onError?.(error instanceof Error && error.message ? error.message : 'Google sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityHint={context === 'signup' ? 'Creates your account with your Google profile' : 'Signs you in with your Google account'}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={handlePress}
      disabled={disabled || busy}
      style={[styles.button, (disabled || busy) && styles.buttonBusy]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.neutral[500]} style={styles.spinner} />
      ) : (
        <GoogleLogo />
      )}
      <Text style={styles.buttonText}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  buttonBusy: {
    opacity: 0.7,
  },
  spinner: {
    marginRight: -4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  unavailable: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
});
