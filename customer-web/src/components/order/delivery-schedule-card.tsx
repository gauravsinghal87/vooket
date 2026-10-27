import { CalendarClock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Order } from '@/types/models';

interface DeliveryScheduleCardProps {
  order: Order;
}

function formatWhen(date: string, time: string): string {
  const parsed = new Date(`${date}T${time}`);

  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Delivery timing for an order: the slot the customer booked, or the ASAP
 * fallback the backend snapshots onto every grocery order.
 */
export function DeliveryScheduleCard({ order }: DeliveryScheduleCardProps) {
  const schedule = order.meta?.delivery_schedule as
    | { delivery_mode?: string; slot_date?: string; start_time?: string; end_time?: string; label?: string }
    | undefined;

  if (!schedule || schedule.delivery_mode !== 'scheduled' || !schedule.slot_date) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm">
        <Zap className="h-4 w-4 shrink-0 text-grocery-700" />
        <div>
          <p className="font-semibold text-neutral-900">Delivering as soon as possible</p>
          <p className="text-neutral-500">We'll notify you when it's on the way.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center gap-3 p-4 text-sm">
      <CalendarClock className="h-4 w-4 shrink-0 text-grocery-700" />
      <div>
        <p className="font-semibold text-neutral-900">
          {formatWhen(schedule.slot_date, (schedule.start_time ?? '').slice(0, 5))}
        </p>
        <p className="text-neutral-500">
          {schedule.label ?? 'Scheduled delivery'} · {order.status === 'SCHEDULED' ? 'Scheduled' : 'Confirmed'}
        </p>
      </div>
    </Card>
  );
}
