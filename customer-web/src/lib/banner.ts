import type { Banner } from '@/types/catalog';

/**
 * Where an Admin-managed banner should take the customer when tapped.
 *
 * Banners carry their own targeting (restaurant / store / product / search /
 * url / service), so the customer app resolves the destination from the banner
 * itself rather than inventing one. Placement decides where the banner is
 * rendered; the target decides what it does when tapped — kept in one place so
 * every surface that renders a banner resolves the same destination.
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