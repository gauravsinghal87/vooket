import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number, currency = 'INR'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function timeFromNow(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ratingLabel(rating: string | number | null | undefined): string {
  if (rating === null || rating === undefined || rating === '') return 'New';
  const r = parseFloat(String(rating));
  return Number.isNaN(r) ? 'New' : r.toFixed(1);
}

export function isOrderPaid(paymentStatus: string | null | undefined): boolean {
  const s = (paymentStatus ?? '').toLowerCase();
  return s === 'paid' || s === 'success' || s === 'refunded' || s === 'partially_refunded';
}

/**
 * Order statuses at or after vendor acceptance.
 *
 * Mirrors the backend state machine (OrderStateMachine): a food order starts at
 * PENDING (legacy PLACED) and moves to ACCEPTED/CONFIRMED once the vendor
 * accepts, then through preparation and dispatch to DELIVERED. Once an order
 * reaches any of these statuses the customer can no longer Cancel or Reorder it.
 */
const VENDOR_ACCEPTED_OR_LATER_STATUSES = [
  'ACCEPTED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PARTNER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'ARRIVED',
  'DELIVERED',
];

export function isOrderPastVendorAcceptance(status: string | null | undefined): boolean {
  return !!status && VENDOR_ACCEPTED_OR_LATER_STATUSES.includes(status);
}
