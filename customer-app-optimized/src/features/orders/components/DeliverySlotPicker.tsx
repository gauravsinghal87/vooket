import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Zap } from 'lucide-react-native';
import type { DeliverySlot } from '@/shared/types/slots';
import { EmptyState, Loader } from '@/shared/components/ui/primitives';
import { colors, withAlpha } from '@/shared/theme';

export type DeliveryMode = 'asap' | 'scheduled';

/**
 * Which module accent paints the selected states: checkout's brand blue by
 * default, the grocery cart's own green when the section lives there.
 */
export type DeliverySlotTone = 'brand' | 'grocery';

interface DeliverySlotPickerProps {
  mode: DeliveryMode;
  onModeChange: (mode: DeliveryMode) => void;
  slots: DeliverySlot[];
  selectedSlotId?: number;
  onSelectSlot: (slot: DeliverySlot) => void;
  isLoading: boolean;
  onRetry: () => void;
  scheduledEnabled: boolean;
  tone?: DeliverySlotTone;
}

/**
 * "As soon as possible" vs. a booked delivery slot.
 *
 * The section renders content only — the caller supplies its own heading so
 * the picker matches the host screen's section titles (checkout and the
 * grocery cart title theirs differently).
 *
 * The selection itself is not held here: both screens read and write the
 * shared cart store, so the timing chosen on the cart is exactly what checkout
 * submits with the order.
 */
export function DeliverySlotPicker({
  mode,
  onModeChange,
  slots,
  selectedSlotId,
  onSelectSlot,
  isLoading,
  onRetry,
  scheduledEnabled,
  tone = 'brand',
}: DeliverySlotPickerProps) {
  const accent = tone === 'grocery' ? colors.grocery[600] : colors.brand[600];
  const accentStrong = tone === 'grocery' ? colors.grocery[700] : colors.brand[700];

  const dates = useMemo(() => {
    const seen = new Map<string, DeliverySlot[]>();
    for (const slot of slots) {
      const items = seen.get(slot.slot_date) ?? [];
      items.push(slot);
      seen.set(slot.slot_date, items);
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);

  // Same calendar behaviour as the web card: one date's slots are shown at a
  // time and the chips scroll horizontally. A stale pick (the store dropped a
  // date, the query refreshed) falls back to the first available date.
  const [activeDate, setActiveDate] = useState<string | undefined>(undefined);
  const datesById = useMemo(() => new Map(dates), [dates]);
  const visibleDate = activeDate && datesById.has(activeDate) ? activeDate : dates[0]?.[0];
  const visibleSlots = visibleDate ? datesById.get(visibleDate) ?? [] : [];

  const parts = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return { weekday: '', date: iso.slice(5) };
    return {
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    };
  };

  const handleMode = (next: DeliveryMode) => {
    if (next !== mode) setActiveDate(undefined);
    onModeChange(next);
  };

  return (
    <View>
      <View style={styles.modeRow}>
        <Pressable onPress={() => handleMode('asap')} style={[styles.modeCard, mode === 'asap' && { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) }]}>
          <View style={[styles.modeIconWrap, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <Zap size={18} color={accent} />
          </View>
          <Text style={styles.modeTitle}>As soon as possible</Text>
          <Text style={styles.modeSub}>Delivered in about 45-60 min</Text>
        </Pressable>
        <Pressable
          onPress={() => handleMode('scheduled')}
          style={[
            styles.modeCard,
            mode === 'scheduled' && { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) },
            !scheduledEnabled && { opacity: 0.5 },
          ]}
        >
          <View style={[styles.modeIconWrap, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <CalendarClock size={18} color={accent} />
          </View>
          <Text style={styles.modeTitle}>Schedule delivery</Text>
          <Text style={styles.modeSub}>{scheduledEnabled ? 'Pick a date and time' : 'No slots available'}</Text>
        </Pressable>
      </View>

      {mode === 'asap' ? (
        <View style={styles.asapNote}>
          <Text style={styles.asapNoteText}>Your order will be delivered as soon as it is ready.</Text>
        </View>
      ) : isLoading ? (
        <Loader label="Loading slots…" />
      ) : slots.length === 0 ? (
        <EmptyState
          title="No delivery slots available"
          message="This store has no open slots right now."
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
          >
            {dates.map(([date]) => {
              const { weekday, date: label } = parts(date);
              const active = date === visibleDate;
              return (
                <Pressable
                  key={date}
                  onPress={() => setActiveDate(date)}
                  style={[
                    styles.dateChip,
                    active && { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) },
                  ]}
                >
                  <Text style={styles.dateChipWeekday}>{weekday}</Text>
                  <Text style={[styles.dateChipDate, active && { color: accentStrong }]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.slotGrid}>
            {visibleSlots.map((slot) => {
              const active = selectedSlotId === slot.id;
              const full = slot.availability <= 0;
              return (
                <Pressable
                  key={slot.id}
                  disabled={!slot.is_active || full}
                  onPress={() => onSelectSlot(slot)}
                  style={[
                    styles.slotCell,
                    active && { borderColor: accent, backgroundColor: withAlpha(accent, 0.06) },
                    (!slot.is_active || full) && { opacity: 0.5 },
                  ]}
                >
                  <Text style={[styles.slotLabel, active && { color: accentStrong }]}>{slot.label}</Text>
                  <Text style={styles.slotAvail}>{full ? 'Full' : `${slot.availability} left`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    gap: 2,
  },
  modeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink[900],
  },
  modeSub: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  asapNote: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 14,
    marginTop: 8,
  },
  asapNoteText: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  dateChip: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  dateChipWeekday: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  dateChipDate: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
    marginTop: 2,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  slotCell: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  slotLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink[900],
  },
  slotAvail: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
});
