import { useState } from 'react';
import { CalendarClock, Clock, Zap } from 'lucide-react';
import type { DeliverySlot } from '@/shared/repositories/interfaces';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/shared/components/ui/state';
import { cn } from '@/shared/utils/utils';

export type DeliveryMode = 'asap' | 'scheduled';

/** Which module accent paints the selected states (checkout's brand blue by
 *  default, the grocery cart's own green when the section lives there). */
export type DeliverySlotTone = 'brand' | 'grocery';

interface DeliverySlotPickerProps {
  mode: DeliveryMode;
  onModeChange: (mode: DeliveryMode) => void;
  slots: DeliverySlot[];
  selectedSlotId?: number;
  onSelectSlot: (slot: DeliverySlot) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  scheduledEnabled: boolean;
  tone?: DeliverySlotTone;
  /** Heading classes so the section matches the host page's section titles. */
  headingClassName?: string;
}

function formatDate(date: string): { day: string; date: string } {
  const parsed = new Date(`${date}T00:00:00`);

  return {
    day: parsed.toLocaleDateString(undefined, { weekday: 'short' }),
    date: parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  };
}

export function DeliverySlotPicker({
  mode,
  onModeChange,
  slots,
  selectedSlotId,
  onSelectSlot,
  isLoading,
  isError,
  onRetry,
  scheduledEnabled,
  tone = 'brand',
  headingClassName = 'text-sm font-bold text-neutral-900',
}: DeliverySlotPickerProps) {
  const dates = Array.from(new Set(slots.map((slot) => slot.slot_date)));
  const [activeDate, setActiveDate] = useState<string | undefined>(undefined);
  const visibleDate = activeDate && dates.includes(activeDate) ? activeDate : dates[0];
  const visibleSlots = slots.filter((slot) => slot.slot_date === visibleDate);

  const activeCard = tone === 'grocery' ? 'border-grocery-500 bg-grocery-50' : 'border-brand-600 bg-brand-50';
  const activeText = tone === 'grocery' ? 'text-grocery-700' : 'text-brand-700';
  const activeIcon = tone === 'grocery' ? 'text-grocery-600' : 'text-brand-600';

  return (
    <section className="space-y-3">
      <h2 className={headingClassName}>Delivery time</h2>

      <div className="grid grid-cols-2 gap-3">
        <ModeOption
          active={mode === 'asap'}
          icon={Zap}
          title="As soon as possible"
          desc="Delivered in about 45-60 min"
          activeClassName={activeCard}
          activeIconClassName={activeIcon}
          onClick={() => onModeChange('asap')}
        />
        <ModeOption
          active={mode === 'scheduled'}
          icon={CalendarClock}
          title="Schedule delivery"
          desc={scheduledEnabled ? 'Pick a date and time' : 'No slots available'}
          disabled={!scheduledEnabled}
          activeClassName={activeCard}
          activeIconClassName={activeIcon}
          onClick={() => onModeChange('scheduled')}
        />
      </div>

      {mode === 'asap' && (
        <Card className="p-4 text-sm text-neutral-600">
          Your order will be delivered as soon as it is ready.
        </Card>
      )}

      {mode === 'scheduled' && (
        <div className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          )}

          {isError && <ErrorState title="Couldn't load delivery slots" action={{ label: 'Retry', onClick: onRetry }} />}

          {!isLoading && !isError && slots.length === 0 && (
            <EmptyState title="No delivery slots available" description="This store has no open slots right now." />
          )}

          {!isLoading && !isError && slots.length > 0 && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dates.map((date) => {
                  const formatted = formatDate(date);
                  const active = date === visibleDate;

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setActiveDate(date)}
                      className={cn(
                        'flex min-w-[84px] flex-col items-center rounded-2xl border px-3 py-2 text-center transition-colors',
                        active ? activeCard : 'border-neutral-200 bg-white'
                      )}
                    >
                      <span className="text-[11px] font-semibold uppercase text-neutral-500">{formatted.day}</span>
                      <span className={cn('text-sm font-bold', active ? activeText : 'text-neutral-900')}>
                        {formatted.date}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {visibleSlots.map((slot) => {
                  const active = slot.id === selectedSlotId;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onSelectSlot(slot)}
                      className={cn(
                        'flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        active ? activeCard : 'border-neutral-200 bg-white hover:border-neutral-300'
                      )}
                    >
                      <span className={cn('text-sm font-bold', active ? activeText : 'text-neutral-900')}>
                        {slot.label}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {slot.availability > 0 ? `${slot.availability} left` : 'Full'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ModeOption({
  active,
  icon: Icon,
  title,
  desc,
  disabled,
  // The defaults keep the original brand accent for any caller without a tone.
  activeClassName = 'border-brand-600 bg-brand-50',
  activeIconClassName = 'text-brand-600',
  onClick,
}: {
  active: boolean;
  icon: typeof Clock;
  title: string;
  desc: string;
  disabled?: boolean;
  activeClassName?: string;
  activeIconClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors',
        active ? activeClassName : 'border-neutral-200 bg-white',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? activeIconClassName : 'text-neutral-400')} />
      <span>
        <span className="block text-sm font-bold text-neutral-900">{title}</span>
        <span className="block text-[11px] text-neutral-500">{desc}</span>
      </span>
    </button>
  );
}
