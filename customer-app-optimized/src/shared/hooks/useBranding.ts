import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/shared/repositories';
import { getBranding, setBranding, type Branding } from '@/shared/utils/branding';

/**
 * Shared `/app-config` query. Every caller shares the same React Query cache
 * (`['app-config']`), so branding is fetched once and reused across the header,
 * the home screens and the auth screens instead of being requested per screen.
 *
 * The query function also publishes the branding block into the module-level
 * cache (`@/shared/utils/branding`) so non-hook code — wallet labels, share copy, the
 * Razorpay modal name — reads the configured platform name.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const data = await repositories.user.getAppConfig();
      setBranding(data?.branding);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** The configured platform branding, falling back gracefully before it loads. */
export function useBranding(): Branding {
  const { data } = useAppConfig();

  const branding = data?.branding;
  if (!branding) return getBranding();

  return {
    ...getBranding(),
    // A blank configured name falls back instead of blanking the label out.
    name: branding.name?.trim() ? branding.name : getBranding().name,
    logo: branding.logo ?? null,
    currency: branding.currency ?? getBranding().currency,
    supportPhone: branding.support_phone ?? null,
    supportEmail: branding.support_email ?? null,
  };
}