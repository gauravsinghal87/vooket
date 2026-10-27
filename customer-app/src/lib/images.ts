/**
 * Centralized image configuration for the customer app (native).
 * Swap `base` for your CDN / object-storage base URL in production.
 *
 * NOTE: On native there is no web-style "current origin", so relative and
 * development-localhost asset URLs are resolved to the reachable backend host
 * derived from `EXPO_PUBLIC_API_BASE_URL` via `assetUrl()`.
 *
 * React Native's <Image> cannot render the web app's SVG data-URI
 * placeholder, so `imageUrl` returns an empty string for missing sources and
 * UI components render their own grey placeholder box instead.
 */
import { assetUrl } from '@/utils/assetUrl';

export const IMAGES = {
  base: '',
};

export function imageUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (IMAGES.base) {
    if (src.startsWith('http')) return src;
    if (src.startsWith('data:')) return src;
    return src.startsWith('/') ? `${IMAGES.base}${src}` : `${IMAGES.base}/${src}`;
  }
  return assetUrl(src);
}

export function isRemoteImage(src: string): boolean {
  return src.startsWith('http') || src.startsWith('/') || src.startsWith('data:');
}