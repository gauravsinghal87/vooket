/**
 * Google sign-in for the native app.
 *
 * customer-web renders Google Identity Services' official button and posts the
 * ID token it produces to `POST /auth/google`. The backend verifies that
 * token's signature, issuer and audience (a single configured web client ID)
 * and answers with the application token — there is no redirect URI
 * registered with Google, no authorization code and no client secret.
 *
 * A React Native app cannot render the GIS web button, so the credential is
 * taken from Google's native Sign-In SDK instead. The SDK is configured with
 * the very same `webClientId` that `/app-config` hands the web app, so the ID
 * token it returns carries `aud = <web client id>` and passes the existing
 * backend verification untouched. The whole app therefore talks to one
 * contract: Google ID token in, application token out.
 *
 * The native SDK only exists inside a development/production build:
 *
 *     npx expo run:ios        (or) npx expo run:android
 *     eas build --profile development
 *
 * Expo Go cannot host it (a custom app scheme cannot be registered there, so
 * Google's own web flow is impossible too), therefore the native module is
 * looked up before the package is imported — importing it without the module
 * present throws — and callers receive an explicit error instead of a fake
 * success.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

const NATIVE_MODULE_NAME = 'RNGoogleSignin';

export const GOOGLE_BUILD_REQUIRED_MESSAGE =
  'Google sign-in needs a development build. Run npx expo run:ios or npx expo run:android — Expo Go cannot use Google sign-in.';

const IOS_NOT_CONFIGURED_MESSAGE =
  'Google sign-in is not configured for iOS yet. Add an iOS OAuth client in the Google Cloud console and set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env.';

const NOT_SET_UP_MESSAGE = 'Google sign-in is not set up correctly yet. Please contact support.';

const GENERIC_FAILURE_MESSAGE = 'Google sign-in could not be completed. Please try again.';

const NETWORK_FAILURE_MESSAGE = 'Could not reach Google. Check your connection and try again.';

const CANCELLED_MESSAGE = 'Google sign-in was cancelled.';

/** A failure the customer can act on. Carries user-facing wording only. */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

function hasNativeModule(): boolean {
  try {
    return Boolean(TurboModuleRegistry.get?.(NATIVE_MODULE_NAME) ?? NativeModules[NATIVE_MODULE_NAME]);
  } catch {
    return false;
  }
}

/**
 * Whether Google sign-in can run on the current runtime. False in Expo Go and
 * anywhere else the native module is absent — the UI uses this to explain the
 * limitation instead of pretending the flow works.
 */
export function isGoogleSignInAvailable(): boolean {
  return hasNativeModule();
}

export interface GoogleSignInOptions {
  /**
   * Public web client ID the backend verifies the token audience against.
   * Supplied by `GET /app-config` (`google.client_id`) — the same value the
   * web app uses.
   */
  webClientId: string;
  /**
   * Public iOS client ID (bundle id `com.superbasket.customer`). Required on
   * iOS until a `GoogleService-Info.plist` ships with the build.
   */
  iosClientId?: string | null;
}

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

function translateError(error: unknown, statusCodes: GoogleSigninModule['statusCodes']): GoogleAuthError {
  if (error instanceof GoogleAuthError) return error;

  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = error instanceof Error ? error.message : '';

  if (__DEV__ && code) console.warn('Google sign-in failed with code:', code);

  if (code && code === String(statusCodes.SIGN_IN_CANCELLED)) return new GoogleAuthError(CANCELLED_MESSAGE);
  if (code && code === String(statusCodes.PLAY_SERVICES_NOT_AVAILABLE)) {
    return new GoogleAuthError('Google Play Services is required for Google sign-in. Please update it and try again.');
  }
  if (/GoogleService-Info\.plist was not found/i.test(message)) return new GoogleAuthError(IOS_NOT_CONFIGURED_MESSAGE);
  if (/client ?id|clientid/i.test(message)) return new GoogleAuthError(NOT_SET_UP_MESSAGE);
  if (/network|internet|connection|timed out/i.test(message)) return new GoogleAuthError(NETWORK_FAILURE_MESSAGE);

  return new GoogleAuthError(GENERIC_FAILURE_MESSAGE);
}

/**
 * Runs the native Google account chooser and resolves with the Google **ID
 * token** to post to `POST /auth/google`. Never logs the token.
 */
export async function signInWithGoogle(options: GoogleSignInOptions): Promise<string> {
  const { webClientId, iosClientId } = options;

  if (!webClientId) throw new GoogleAuthError(NOT_SET_UP_MESSAGE);
  if (!hasNativeModule()) throw new GoogleAuthError(GOOGLE_BUILD_REQUIRED_MESSAGE);

  let mod: GoogleSigninModule;
  try {
    mod = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new GoogleAuthError(GOOGLE_BUILD_REQUIRED_MESSAGE);
  }

  const { GoogleSignin, statusCodes } = mod;

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    GoogleSignin.configure({
      webClientId,
      iosClientId: iosClientId ?? undefined,
    });

    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') throw new GoogleAuthError(CANCELLED_MESSAGE);

    const idToken = result.data.idToken;
    if (!idToken) throw new GoogleAuthError(GENERIC_FAILURE_MESSAGE);

    return idToken;
  } catch (error) {
    throw translateError(error, statusCodes);
  }
}
