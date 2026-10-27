# Customer App (React Native)

Native Expo (SDK 54) replica of `customer-web` — the customer side of the all-in-one delivery & ride platform. Food, grocery and rides in one app, sharing one Laravel backend (`http://localhost:8000`). No backend or mock changes are required.

## Stack

- **Expo Router** (file-based routing, routes in `app/`) — `src/` holds non-route code (components, hooks, stores, API layer).
- **React Query** (`@tanstack/react-query`) for server state; **Zustand** (`src/stores/`) for client state (auth, cart, app, toast, map draft).
- **react-native-maps** with a provider chain (Apple Maps on iOS, Google Maps on Android) — all map features degrade gracefully to a placeholder when the provider is missing (`getAppConfig().maps.enabled`).
- **react-native-safe-area-context**, **lucide-react-native** icons, **expo-crypto** for payment verification hashes.
- Theme tokens live in `src/theme/index.ts` (ported from `customer-web`'s CSS). Note: `colors.neutral` only ships steps 100–500, 700 — never use 50/600/800 on `neutral`.

## Getting started

```bash
bun install        # or npm install
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL to the Laravel backend, e.g. http://localhost:8000
npx expo start
```

Open on device with **Expo Go**, or build a dev client for maps and Google sign-in:

```bash
npx expo run:ios
```

### CLI / verification

```bash
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npx expo install --check
npx expo export         # production bundle smoke-test
```

## Architecture notes

- All backend calls go through `src/api/repositories.ts` (`repositories.food|grocery|rides|orders|cart|wallet|payments|user|auth`). Paginated endpoints return `Paginated<T>`; use the `unwrap` helpers.
- Authentication: `src/stores/authStore.ts` (email/phone/OTP/register, forgot/reset password, persisted token in `expo-secure-store`). Screens live in `app/auth/` and share `src/components/auth/AuthPage.tsx`; `?redirect=` returns the customer to the page that asked them to sign in, exactly like `RequireAuth` on the web.
- Payments: `src/lib/payments.ts` — `createUsableCheckout` + `completeOrderPayment`. Real (non-mock) intents open the native Razorpay Checkout (`react-native-razorpay`) with the server order id + public key id, then verify the signed response server-side — the SDK response never marks a payment paid on its own. The SDK is a native module, so it only runs in a development/production build; in Expo Go it raises a clear error (never a fake cancellation). Mock intents still auto-verify against the server for demos.
- Realtime order/ride tracking is 5s polling (`src/lib/realtime.ts`) with `useRealtimeOrder` / `useRealtimeRide`.

## Google sign-in

Same contract as `customer-web`: the app obtains a Google **ID token** and posts it to `POST /auth/google`; the backend verifies it (JWKS signature, issuer, audience) and answers with the application token. No redirect URI, no authorization code, no client secret, no backend change.

- The audience is the web client ID served by `GET /app-config` (`google.client_id`, the same value the web button uses). The Google divider/button only render when `google.enabled` is true.
- `customer-web` renders Google Identity Services' browser button; a native app cannot, so the credential comes from `@react-native-google-signin/google-signin` behind `src/auth/googleAuth.ts`, configured with that same `webClientId` — the ID token therefore carries `aud = <web client id>` and passes the existing server verification untouched.
- **Expo Go cannot use Google sign-in.** Google only accepts http(s) redirect URIs for a web client, a custom app scheme cannot be registered in Expo Go, and the native SDK only exists in a real build. The auth screen detects this and replaces the Google button with a note asking for a development build — never a fake success.
- Build the app when you want Google sign-in:

  ```bash
  npx expo run:ios        # or: npx expo run:android
  npx eas-cli@latest build --profile development
  ```

- Google Cloud console (the project that owns the web client) still needs the native clients — public IDs only, no secrets, no backend change:
  - **Android**: an Android client for package `com.superbasket.customer` plus the signing-certificate SHA-1 (debug keystore: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`).
  - **iOS**: an iOS client for bundle `com.superbasket.customer`, its public id in `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and this entry in `app.json` → `expo.plugins` (registers the reversed-client-id URL scheme):

    ```json
    ["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<iOS-CLIENT-ID>" }]
    ```

    Until an iOS client exists the entry is deliberately left out: the plugin's default mode demands a `google-services.json` / `GoogleService-Info.plist` this app does not use and would break `npx expo run:*` prebuild.
- Password-reset links are generated by the backend against the web URL, so emailed links open `customer-web`; `app/auth/reset.tsx` accepts the same `?token=&email=` when deep-linked (`superbasket://auth/reset?...`).

## Known gaps vs web

- Google sign-in only runs in a development/production build (see [Google sign-in](#google-sign-in)); in Expo Go the auth screen explains that instead of offering a dead button.
- On-device manual passes (login, register, OTP, Google, session, logout) still need one run — this machine has no Xcode or Android SDK, so the flows were verified at the API level against the local backend instead (`npx tsc --noEmit`, `npx expo-doctor`, `npx expo export` for both platforms pass).
- "Pay with wallet" quick-link on the wallet screen is intentionally not wired to a destination.
- Companion request / chat / notification-bell deep links are stubs (toast "coming soon").