# Mobile Runtime Audit

Date: 2026-11-02
Platform: `customer-app-optimized` (Expo Router / React Native).

## Availability

No Android emulator, physical Android device, iOS simulator or Android SDK is available locally. Therefore the following are **not measured** and are not estimated:

- cold startup time;
- time to first screen;
- JS thread/UI thread frame timing;
- module-switch render latency on device;
- native memory usage;
- image cache behavior on a real network.

## Verified on this machine

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npx expo lint --no-cache` | Pass |
| `npx expo-doctor` | 18/18 checks passed |
| `npx expo export --clear --platform web --output-dir dist-web` | Pass; web entry 4.2 MB (Expo web output) |
| `npx expo export --clear --platform ios --output-dir dist-ios` | Pass; Hermes bundle 6.38 MB |
| `npx expo export --clear --platform android --output-dir dist-android` | Pass; Hermes bundle 6.38 MB |
| EAS Android APK | Previously built (see `docs/refactor/VERIFICATION_AND_REGRESSION.md`) |

The exports were run with `--clear` after restoring `.env` to the tracked production URL. The web entry and both Hermes bundles contain `vooketapi`. The `localhost:8000` fallback string also remains in the bundles because it is the code default when the env var is absent; it is not the configured value.

The APK artifact is `customer-app-optimized/builds/vooket-customer-v1.0.0-build2.apk` with SHA-256 `f186024d7b0f06ea31f065ab0b2221f372fc035646bfd10a93d92ede19b4c01f`. It was not rebuilt after these performance edits; the JS-only changes require a new EAS build to include them in an installable APK.

## Implemented mobile changes verified by export/typecheck

- Shared discovery query for Food/Grocery.
- Shared QueryClient with auth-transition cache clearing.
- Guest 401 does not clear public cache.
- Rides destination FlatList virtualization props and stable keys.
- Category asset resized from 1.07 MB to 86 kB.
- Longer stale times for banners/categories.

## Known mobile risks

- Food/Grocery home screens use `ScrollView` and map all content. Large feeds can cause high memory/render cost.
- Product cards use React Native `Image`; not all surfaces use `expo-image`.
- The APK artifact predates the latest performance changes.

## Recommended next step

Build a new preview APK through EAS and run a device profile (cold start, first Food, first Grocery, warm module switch, Rides map). Until then, do not claim mobile runtime improvements.
