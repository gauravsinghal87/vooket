import type { Banner } from '@/shared/types/catalog';

/**
 * Where an Admin-managed banner should take the customer when tapped.
 * Ported from customer-web/src/lib/banner.ts.
 */
export function bannerRoute(b: Banner): string {
  switch (b.target_type) {
    case 'restaurant':
      return b.target_id ? `/restaurant/${b.target_id}` : '/restaurants';
    case 'store':
      return b.target_id ? `/store/${b.target_id}` : '/stores';
    case 'product':
      return b.target_id ? `/product/${b.target_id}` : '/grocery';
    case 'search':
      return b.target_url ?? '/search';
    case 'url':
      return b.target_url ?? '/';
    case 'service':
      return b.target_url ?? '/';
    default:
      return '/';
  }
}