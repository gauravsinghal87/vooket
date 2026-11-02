/**
 * Central asset URL resolver for the native app.
 *
 * React Native's <Image> needs a fully qualified URL — there is no web-style
 * "current origin" to resolve a leading `/storage/...` path against, and the
 * backend serializes asset URLs using `APP_URL` (typically `http://localhost:8000`),
 * which is unreachable from a physical device.
 *
 * Everything derives the reachable backend origin from `EXPO_PUBLIC_API_BASE_URL`
 * (e.g. `http://192.168.2.231:8000/api/v1`) so API calls and asset fetches go to
 * the exact same host. Storage/asset paths deliberately keep their `/storage`
 * prefix — `/api/v1` is never prepended.
 */

function deriveOrigin(base: string | undefined): string {
  const candidate = base?.trim().replace(/\/+$/, '') || '';
  const match = /^(https?:\/\/[^/]+)/i.exec(candidate);
  return match?.[1] ?? 'http://localhost:8000';
}

export const ASSET_ORIGIN = deriveOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);

function replaceDevelopmentHost(url: string): string {
  const match = /^(https?:\/\/)([^/]+)(\/.*)?$/i.exec(url);
  if (!match) return url;
  const host = match[2]?.split(':')[0]?.toLowerCase();
  const isLocalDevHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  if (!isLocalDevHost) return url;
  const rest = match[3] ?? '';
  return `${ASSET_ORIGIN}${rest}`;
}

export function assetUrl(src: string | null | undefined): string {
  if (!src) return '';

  // Data URIs (placeholder SVGs / inline images) pass through untouched.
  if (src.startsWith('data:')) return src;

  if (src.startsWith('http://') || src.startsWith('https://')) {
    // Already absolute. Only rewrite development-localhost hosts (which are the
    // backend's own assets); any other third-party image URL is left alone.
    return replaceDevelopmentHost(src);
  }

  if (src.startsWith('/')) {
    // Absolute path like /storage/banners/foo.jpg -> origin + path.
    return `${ASSET_ORIGIN}${src}`;
  }

  // Bare path like storage/banners/foo.jpg -> origin + slash + path.
  return `${ASSET_ORIGIN}/${src}`;
}