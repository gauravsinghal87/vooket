import { useQuery } from '@tanstack/react-query';
import { configApi } from '@/repositories/driver';

/**
 * Resolves the client-safe Google Maps API key from the public config/maps
 * endpoint. Returns null when maps are disabled or no public key is set so
 * consumers can fall back to external route links.
 */
export function useMapsKey(): string | null {
  const { data } = useQuery({
    queryKey: ['maps-config'],
    queryFn: () => configApi.maps(),
    staleTime: 5 * 60 * 1000,
  });
  return data?.enabled === true && data?.public_key ? data.public_key : null;
}