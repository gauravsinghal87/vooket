# Image Loading Audit

Date: 2026-11-02

## Web

- `src/shared/components/ui/image.tsx` uses native lazy loading by default (`loading="lazy"`).
- Non-eager images now use `decoding="async"`; eager images keep eager loading.
- Category artwork that is part of the first viewport remains eager; off-screen artwork is lazy.
- `all-category.png` was 1,067.34 kB at 2500x2500 and is displayed at roughly 70–100 CSS px. It is now 256x256 and 87.69 kB in the production build.
- Measured initial Food image payload: 87,691 B across 16 images.
- The app does not generate `srcset` variants; it renders the URL supplied by the API.

## Mobile

- `ProductImage` uses React Native `Image` with a placeholder/error fallback.
- Some grocery components use `expo-image` (for example hero/grocery components) for caching/transition support.
- The product image path was not migrated wholesale to `expo-image`; doing so would change fallback behavior across every card and was outside the safe optimization scope.
- `assets/images/all-category.png` was resized from 1.07 MB to 86 kB (256x256).

## API image data

- The local backend data inspected uses `http://localhost:8000/storage/...` URLs. This is a local data/configuration issue, not a frontend transformation.
- The API does not currently expose measured thumb/card/detail variants in this audit.
- Long image metadata is part of the server serialization cost; no backend serializer was changed.

## Recommendations

1. Backend/CDN: serve sized variants and production absolute URLs.
2. Web: use `srcset`/`sizes` if variants exist.
3. Mobile: use `expo-image` consistently with explicit `cachePolicy` once fallback behavior is validated on device.
4. Keep the resized category asset; do not reintroduce a 2500x2500 PNG for a 70 px tile.
5. Measure real remote image load on a device/production network before claiming further image wins.

## Limitations

- No device image-cache profile or production CDN logs were available.
- The local localhost image URLs prevent a representative remote product-image benchmark.
