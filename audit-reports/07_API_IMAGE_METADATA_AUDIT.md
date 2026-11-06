# API Image Metadata Audit

Date: 2026-11-02

## Findings

- Discovery, restaurant, store and product payloads carry image URLs and related metadata. The frontend does not download every image eagerly; web `Image` uses lazy loading by default, and the measured initial Food image payload was 87,691 B across 16 images.
- The largest bundled image was `all-category.png`: 1,067.34 kB at 2500x2500, displayed at roughly 70–100 CSS px. It was resized to 256x256 and is now 87.69 kB in the web build and 86 kB in the mobile asset set.
- The backend data inspected locally uses `http://localhost:8000/storage/...` URLs. That is a backend/data configuration issue in the local dataset, not a frontend code path. Production image delivery was not changed.
- No image width/height metadata was measured in the API payload separately; the payload bytes above include the URLs and any metadata the API returns.
- Mobile `ProductImage` uses React Native `Image` with a grey placeholder fallback; some grocery components use `expo-image`. The product image path was not migrated wholesale because it would change fallback and caching behavior across every card.

## Web behavior

- `Image` defaults to `loading="lazy"`.
- Non-eager images use `decoding="async"`.
- Category artwork that participates in the first viewport remains eager.
- No `srcset`/responsive image variants exist in this codebase; API images are displayed at a fixed card size.

## Recommendations

1. Backend: return properly sized image variants (thumb/card/detail) and absolute production URLs.
2. Backend: omit unused image metadata from rails.
3. Frontend: if the API exposes variants, use `srcset` for web and the correct size for mobile cards.
4. Use a CDN with cache headers and modern formats (WebP/AVIF) where supported.
5. Do not resize remote product images on the client; request the right variant.

## Limitations

- No production CDN logs or image byte waterfall per card were available.
- The local dataset’s localhost image URLs prevent a meaningful production image-load benchmark for remote product images.
