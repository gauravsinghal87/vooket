/**
 * Shared platform branding, loaded from the backend General Settings via the
 * `/app-config` endpoint and cached at module scope.
 *
 * Hooks (see `@/hooks/useBranding`) publish the API response into this cache so
 * any code — components that cannot call a hook, helpers, payment libraries —
 * can read the configured platform name and logo without issuing its own
 * request. The values mirror `AppConfig.branding` from the backend.
 */

export interface Branding {
  name: string;
  logo: string | null;
  currency: string;
  supportPhone: string | null;
  supportEmail: string | null;
}

export const FALLBACK_BRANDING: Branding = {
  name: 'SuperBasket',
  logo: null,
  currency: 'INR',
  supportPhone: null,
  supportEmail: null,
};

let cache: Branding = { ...FALLBACK_BRANDING };

/** Publish branding fetched from `/app-config` into the shared module cache. */
export function setBranding(branding?: Partial<Branding> | null): void {
  if (!branding) return;
  cache = { ...cache, ...branding };
}

/** Read the currently known branding (never throws; falls back before load). */
export function getBranding(): Branding {
  return cache;
}

/** First letters of up to two words, used when no logo is configured. */
export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SB';
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'SB';
}