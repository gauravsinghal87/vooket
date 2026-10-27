// Centralized image configuration for the customer app.
// Swap `base` for your CDN / object-storage base URL in production.
export const IMAGES = {
  base: '',
  placeholder:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e9e7e3"/><circle cx="100" cy="88" r="30" fill="#c9c5bd"/><rect x="56" y="128" width="88" height="12" rx="6" fill="#c9c5bd"/><rect x="72" y="148" width="56" height="12" rx="6" fill="#d6d3cc"/></svg>`
    ),
};

// The backend serializes asset URLs with its own `APP_URL` (a dev host such as
// `http://localhost:8000`), which is not the origin the frontend is served
// from — so those image hosts are rewritten to the API origin before loading,
// mirroring customer-app's `assetUrl()`. The origin is derived from
// `VITE_API_BASE_URL` (e.g. `http://localhost:8001/api/v1` → `http://localhost:8001`).
const API_ORIGIN = (() => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return /^(https?:\/\/[^/]+)/i.exec(base.trim())?.[1] ?? '';
})();

/** Point backend dev-host asset URLs at the API origin; leave every other URL alone. */
function rewriteDevAssetHost(url: string): string {
  if (!API_ORIGIN) return url;
  const match = /^(https?:\/\/)([^/]+)(\/.*)?$/i.exec(url);
  if (!match) return url;
  const host = match[2]?.split(':')[0]?.toLowerCase();
  const isLocalDevHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  if (!isLocalDevHost) return url;
  return `${API_ORIGIN}${match[3] ?? ''}`;
}

export function imageUrl(src: string | null | undefined): string {
  if (!src) return IMAGES.placeholder;
  if (src.startsWith('data:')) return src;
  if (/^https?:/.test(src)) return rewriteDevAssetHost(src);
  // `/storage/...` belongs to the backend, not the frontend origin — prefix it
  // with the API origin (Vite serves no /storage of its own).
  if (src.startsWith('/storage/')) {
    return API_ORIGIN ? `${API_ORIGIN}${src}` : src;
  }
  if (src.startsWith('/')) return src;
  return `${IMAGES.base}${src}`;
}
