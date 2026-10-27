import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, X, CalendarClock } from 'lucide-react';
import { deliverySlotsApi, outletsApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import type { DeliverySlot } from '@/typings/models';

type SlotForm = {
  store_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_orders: string;
  lead_time_min: string;
};

const emptyForm: SlotForm = {
  store_id: '',
  slot_date: '',
  start_time: '',
  end_time: '',
  max_orders: '10',
  lead_time_min: '60',
};

function SlotModal({
  slot,
  storeId,
  onClose,
}: {
  slot: DeliverySlot | null;
  storeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const outlets = useQuery({ queryKey: ['vendor-outlets'], queryFn: () => outletsApi.list() });
  const [form, setForm] = useState<SlotForm>(
    slot
      ? {
          store_id: String(slot.store_id),
          slot_date: slot.slot_date,
          start_time: slot.start_time.slice(0, 5),
          end_time: slot.end_time.slice(0, 5),
          max_orders: String(slot.max_orders),
          lead_time_min: String(slot.lead_time_min),
        }
      : { ...emptyForm, store_id: storeId }
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        store_id: Number(form.store_id),
        slot_date: form.slot_date,
        start_time: form.start_time,
        end_time: form.end_time,
        max_orders: Number(form.max_orders),
        lead_time_min: Number(form.lead_time_min),
      };

      return slot ? deliverySlotsApi.update(slot.id, body) : deliverySlotsApi.create(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vendor-delivery-slots'] });
      toast(slot ? 'Delivery slot updated' : 'Delivery slot published');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const update = (patch: Partial<SlotForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const canSave = form.store_id && form.slot_date && form.start_time && form.end_time && !save.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">{slot ? 'Edit delivery slot' : 'New delivery slot'}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {!slot && (
            <Field label="Store">
              <Select value={form.store_id} onChange={(e) => update({ store_id: e.target.value })}>
                <option value="">Select a store</option>
                {(outlets.data ?? []).map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Date">
            <Input type="date" value={form.slot_date} onChange={(e) => update({ slot_date: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <Input type="time" value={form.start_time} onChange={(e) => update({ start_time: e.target.value })} />
            </Field>
            <Field label="End time">
              <Input type="time" value={form.end_time} onChange={(e) => update({ end_time: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max orders">
              <Input
                type="number"
                min={1}
                value={form.max_orders}
                onChange={(e) => update({ max_orders: e.target.value })}
              />
            </Field>
            <Field label="Booking cutoff (min)">
              <Input
                type="number"
                min={0}
                value={form.lead_time_min}
                onChange={(e) => update({ lead_time_min: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave}>
            {slot ? 'Save changes' : 'Publish slot'}
          </Button>
        </div>
      </Card>
    </div>
  );
}


function BulkSlotModal({
  storeId,
  onClose,
}: {
  storeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const outlets = useQuery({ queryKey: ['vendor-outlets'], queryFn: () => outletsApi.list() });
  const shiftsQuery = useQuery({ queryKey: ['vendor-delivery-shifts'], queryFn: () => deliverySlotsApi.shifts() });

  const [form, setForm] = useState({
    store_id: storeId,
    from_date: '',
    to_date: '',
    shifts: [] as string[],
    max_orders: '10',
    lead_time_min: '60',
  });
  const [error, setError] = useState<string | null>(null);

  const toggleShift = (key: string) => {
    setForm((prev) => ({
      ...prev,
      shifts: prev.shifts.includes(key)
        ? prev.shifts.filter((s) => s !== key)
        : [...prev.shifts, key],
    }));
  };

  const save = useMutation({
    mutationFn: () => {
      setError(null);
      return deliverySlotsApi.bulkCreate({
        store_id: Number(form.store_id),
        from_date: form.from_date,
        to_date: form.to_date,
        shifts: form.shifts,
        max_orders: Number(form.max_orders),
        lead_time_min: Number(form.lead_time_min),
      });
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['vendor-delivery-slots'] });
      const skipped = result.skipped_count ? `, ${result.skipped_count} skipped` : '';
      toast(`Created ${result.created_count} slot(s)${skipped}`);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
      toast(err.message, 'error');
    },
  });

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const shiftEntries = Object.entries(shiftsQuery.data ?? {});
  const canSave =
    !!form.store_id &&
    !!form.from_date &&
    !!form.to_date &&
    form.shifts.length > 0 &&
    !save.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">New delivery slot</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Store">
            <Select value={form.store_id} onChange={(e) => update({ store_id: e.target.value })}>
              <option value="">Select a store</option>
              {(outlets.data ?? []).map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From date">
              <Input type="date" value={form.from_date} onChange={(e) => update({ from_date: e.target.value })} />
            </Field>
            <Field label="To date">
              <Input type="date" value={form.to_date} onChange={(e) => update({ to_date: e.target.value })} />
            </Field>
          </div>

          <Field label="Shifts">
            <div className="flex flex-col gap-2">
              {shiftEntries.map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.shifts.includes(key)}
                    onChange={() => toggleShift(key)}
                  />
                  <span className="capitalize">{key}</span>
                  <span className="text-xs text-neutral-500">
                    ({value.start.slice(0, 5)} – {value.end.slice(0, 5)})
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max orders">
              <Input
                type="number"
                min={1}
                value={form.max_orders}
                onChange={(e) => update({ max_orders: e.target.value })}
              />
            </Field>
            <Field label="Booking cutoff (min)">
              <Input
                type="number"
                min={0}
                value={form.lead_time_min}
                onChange={(e) => update({ lead_time_min: e.target.value })}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? 'Creating…' : 'Create Slots'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function DeliverySlotsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DeliverySlot | null>(null);
  const [creating, setCreating] = useState(false);

  const outlets = useQuery({ queryKey: ['vendor-outlets'], queryFn: () => outletsApi.list() });
  const slots = useQuery({ queryKey: ['vendor-delivery-slots'], queryFn: () => deliverySlotsApi.list() });

  const toggle = useMutation({
    mutationFn: (slot: DeliverySlot) => deliverySlotsApi.update(slot.id, { is_active: !slot.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vendor-delivery-slots'] }),
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (slot: DeliverySlot) => deliverySlotsApi.remove(slot.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vendor-delivery-slots'] });
      toast('Delivery slot deleted');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const storeName = (storeId: number) => outlets.data?.find((outlet) => outlet.id === storeId)?.name ?? `Store #${storeId}`;

  return (
    <>
      <PageHeader
        title="Delivery slots"
        description="Publish the times customers can book a grocery delivery"
        actions={
          <Button
            onClick={() => setCreating(true)}
            disabled={!outlets.data || outlets.data.length === 0}
          >
            <CalendarClock className="h-4 w-4" /> New slot
          </Button>
        }
      />

      {slots.isLoading ? (
        <Skeleton className="py-10" />
      ) : slots.isError ? (
        <ErrorState onRetry={() => void slots.refetch()} />
      ) : !slots.data || slots.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-10 text-center text-sm text-neutral-400">
          No delivery slots published yet. Add one so customers can schedule deliveries.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {slots.data.map((slot) => {
            const full = slot.availability <= 0;
            const past = new Date(`${slot.slot_date}T${slot.end_time}`) < new Date();

            return (
              <Card key={slot.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{slot.label}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(`${slot.slot_date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {storeName(slot.store_id)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      !slot.is_active
                        ? 'bg-ink-50 text-neutral-500'
                        : past
                          ? 'bg-ink-50 text-neutral-500'
                          : full
                            ? 'bg-red-50 text-red-600'
                            : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {!slot.is_active ? 'Disabled' : past ? 'Finished' : full ? 'Full' : 'Open'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-neutral-500">
                  {slot.booked_orders}/{slot.max_orders} booked · cutoff {slot.lead_time_min} min before
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(slot)} disabled={toggle.isPending}>
                    {slot.is_active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(slot)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(slot)} disabled={remove.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <BulkSlotModal
          storeId={String(outlets.data?.[0]?.id ?? '')}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && <SlotModal slot={editing} storeId={String(editing.store_id)} onClose={() => setEditing(null)} />}
    </>
  );
}
