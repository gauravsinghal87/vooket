import type { Address } from '@/typings/models';

export function formatAddress(address?: Address | null): string {
  if (!address) return '—';
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.postal_code,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : `#${address.id}`;
}