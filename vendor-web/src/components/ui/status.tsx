import { cn } from '@/lib/utils';

const orderStatusTone: Record<string, string> = {
  placed: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  pending: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  preparing: 'bg-amber-50 text-amber-700 ring-amber-200',
  ready: 'bg-blue-50 text-blue-700 ring-blue-200',
  partner_assigned: 'bg-violet-50 text-violet-700 ring-violet-200',
  picked_up: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  out_for_delivery: 'bg-blue-50 text-blue-700 ring-blue-200',
  arrived: 'bg-teal-50 text-teal-700 ring-teal-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  active: 'bg-amber-50 text-amber-700 ring-amber-200',
  scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
  requested: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  searching_driver: 'bg-amber-50 text-amber-700 ring-amber-200',
  driver_assigned: 'bg-violet-50 text-violet-700 ring-violet-200',
  driver_arriving: 'bg-blue-50 text-blue-700 ring-blue-200',
  driver_arrived: 'bg-blue-50 text-blue-700 ring-blue-200',
  trip_started: 'bg-blue-50 text-blue-700 ring-blue-200',
  trip_in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  trip_completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  no_driver_found: 'bg-red-50 text-red-700 ring-red-200',
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        orderStatusTone[key] ?? 'bg-neutral-100 text-neutral-700 ring-neutral-200',
        className
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}

export function RideStatusBadge({ status, className }: { status: string; className?: string }) {
  return <OrderStatusBadge status={status} className={className} />;
}

const approvalTone: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  suspended: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  inactive: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  system: 'bg-violet-50 text-violet-700 ring-violet-200',
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  offline: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  on_trip: 'bg-blue-50 text-blue-700 ring-blue-200',
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  unverified: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        approvalTone[key] ?? 'bg-neutral-100 text-neutral-700 ring-neutral-200',
        className
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}