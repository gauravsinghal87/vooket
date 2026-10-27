import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { fareRulesApi, settingsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';
import type { AdminFareRule, AdminVehicleType } from '@/typings/models';

type FareRuleDraft = {
  vehicle_type_id: string;
  zone_id: string;
  city: string;
  base_fare: string;
  per_km: string;
  per_minute: string;
  minimum_fare: string;
  booking_fee: string;
  platform_fee: string;
  tax_rate: string;
  waiting_fee_per_minute: string;
  cancellation_fee: string;
  driver_commission_percent: string;
  is_active: boolean;
};

const money = (v?: string | number | null): string => formatCurrency(Number(v ?? 0));
const num = (v?: string | number | null): string => {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

function emptyDraft(vehicleTypes: AdminVehicleType[]): FareRuleDraft {
  const fallback = vehicleTypes.find((vt) => vt.is_active) ?? vehicleTypes[0];
  return {
    vehicle_type_id: fallback ? String(fallback.id) : '',
    zone_id: '',
    city: '',
    base_fare: '',
    per_km: '',
    per_minute: '',
    minimum_fare: '',
    booking_fee: '',
    platform_fee: '',
    tax_rate: '',
    waiting_fee_per_minute: '',
    cancellation_fee: '',
    driver_commission_percent: '',
    is_active: true,
  };
}

function draftFromRule(rule: AdminFareRule): FareRuleDraft {
  return {
    vehicle_type_id: String(rule.vehicle_type_id),
    zone_id: rule.zone_id ?? '',
    city: rule.city ?? '',
    base_fare: rule.base_fare ?? '',
    per_km: rule.per_km ?? '',
    per_minute: rule.per_minute ?? '',
    minimum_fare: rule.minimum_fare ?? '',
    booking_fee: rule.booking_fee ?? '',
    platform_fee: rule.platform_fee ?? '',
    tax_rate: rule.tax_rate ?? '',
    waiting_fee_per_minute: rule.waiting_fee_per_minute ?? rule.waiting_charge_per_min ?? '',
    cancellation_fee: rule.cancellation_fee ?? '',
    driver_commission_percent: rule.driver_commission_percent != null ? String(rule.driver_commission_percent) : '',
    is_active: Boolean(rule.is_active),
  };
}

function requiredBody(draft: FareRuleDraft): Record<string, unknown> {
  return {
    vehicle_type_id: Number(draft.vehicle_type_id),
    base_fare: draft.base_fare,
    per_km: draft.per_km,
    per_minute: draft.per_minute,
    minimum_fare: draft.minimum_fare,
  };
}

function optionalBody(draft: FareRuleDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (draft.zone_id.trim()) body.zone_id = draft.zone_id.trim();
  if (draft.city.trim()) body.city = draft.city.trim();
  const optionalKeys = [
    'booking_fee',
    'platform_fee',
    'tax_rate',
    'waiting_fee_per_minute',
    'cancellation_fee',
    'driver_commission_percent',
  ] as const;
  for (const key of optionalKeys) {
    if (draft[key].trim() !== '') body[key] = draft[key];
  }
  return body;
}

function payloadFromDraft(draft: FareRuleDraft): Record<string, unknown> {
  return { ...requiredBody(draft), ...optionalBody(draft), is_active: draft.is_active };
}

function isRuleComplete(draft: FareRuleDraft): boolean {
  const required = ['base_fare', 'per_km', 'per_minute', 'minimum_fare'] as const;
  return (
    draft.vehicle_type_id !== '' &&
    required.every((k) => {
      const value = draft[k];
      return value.trim() !== '' && !Number.isNaN(Number(value));
    })
  );
}

function PreviewPanel({ draft }: { draft: FareRuleDraft }) {
  const [distance, setDistance] = useState('4.31');
  const [duration, setDuration] = useState('9');

  const body = useMemo<Record<string, unknown> | null>(() => {
    const d = Number(distance);
    const m = Number(duration);
    if (!isRuleComplete(draft) || !(d > 0) || !(m >= 1)) return null;
    return { ...requiredBody(draft), ...optionalBody(draft), distance_km: d, duration_min: m };
  }, [draft, distance, duration]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fare-preview', body],
    queryFn: () => fareRulesApi.preview(body!),
    enabled: body !== null,
  });

  const sym = (value?: string | null): string => (value === 'USD' ? '$' : '₹');
  const currency = data?.currency ?? 'INR';

  const rows = data
    ? [
        { label: 'Base fare', value: data.base_fare },
        { label: 'Distance', value: data.distance_charge },
        { label: 'Time', value: data.time_charge },
        { label: 'Booking fee', value: data.booking_fee },
        { label: 'Platform fee', value: data.platform_fee },
        { label: 'Tax', value: data.tax_amount },
        { label: 'Subtotal', value: data.subtotal, bold: true },
      ]
    : [];

  return (
    <div className="rounded-xl border border-ink-100 bg-neutral-50 p-4">
      <p className="mb-3 text-sm font-semibold text-neutral-900">Fare Preview</p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Distance (km)</label>
          <Input type="number" min="0" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Duration (min)</label>
          <Input type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>

      {body === null ? (
        <p className="text-xs text-neutral-400">Fill the required fare fields to preview the estimate.</p>
      ) : isLoading ? (
        <p className="text-xs text-neutral-400">Calculating…</p>
      ) : isError ? (
        <p className="text-xs text-red-600">Preview failed. Check the field values.</p>
      ) : data ? (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className={cn('text-neutral-500', row.bold && 'font-medium text-neutral-700')}>{row.label}</span>
              <span className={cn('tabular-nums', row.bold ? 'font-bold text-neutral-900' : 'text-neutral-800')}>
                {sym(currency)}
                {Number(row.value).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-sm">
            <span className="font-semibold text-neutral-900">Estimated fare</span>
            <span className="font-bold tabular-nums text-brand-700">
              {sym(currency)}
              {Number(data.estimated_fare).toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FareRuleFormModal({
  open,
  onOpenChange,
  editing,
  vehicleTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminFareRule | null;
  vehicleTypes: AdminVehicleType[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<FareRuleDraft>(() =>
    editing ? draftFromRule(editing) : emptyDraft(vehicleTypes)
  );

  useEffect(() => {
    setDraft(editing ? draftFromRule(editing) : emptyDraft(vehicleTypes));
  }, [editing, vehicleTypes]);

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) return fareRulesApi.update(editing.id, body);
      return fareRulesApi.create(body);
    },
    onSuccess: () => {
      toast(editing ? 'Fare rule updated' : 'Fare rule created');
      void qc.invalidateQueries({ queryKey: ['admin-fare-rules'] });
      onOpenChange(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = <K extends keyof FareRuleDraft>(key: K, value: FareRuleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = isRuleComplete(draft);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? `Edit fare rule · ${editing.vehicle_type?.name ?? `#${editing.id}`}` : 'New fare rule'}
      description={editing ? 'Adjust pricing, commission or status. Changes apply immediately.' : 'Pricing used by the ride fare engine.'}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Vehicle type</label>
              <Select value={draft.vehicle_type_id} disabled={!!editing} onChange={(e) => set('vehicle_type_id', e.target.value)}>
                {vehicleTypes.map((vt) => (
                  <option key={vt.id} value={String(vt.id)}>
                    {vt.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Status</label>
              <label className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5',
                draft.is_active ? 'border-emerald-400 bg-emerald-50' : 'border-ink-100'
              )}>
                <span className="text-sm font-medium text-neutral-800">{draft.is_active ? 'Active' : 'Inactive'}</span>
                <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Base fare" value={draft.base_fare} onChange={(v) => set('base_fare', v)} required />
            <NumberField label="Per KM" value={draft.per_km} onChange={(v) => set('per_km', v)} required />
            <NumberField label="Per minute" value={draft.per_minute} onChange={(v) => set('per_minute', v)} required />
            <NumberField label="Minimum fare" value={draft.minimum_fare} onChange={(v) => set('minimum_fare', v)} required />
            <NumberField label="Booking fee" value={draft.booking_fee} onChange={(v) => set('booking_fee', v)} />
            <NumberField label="Platform fee" value={draft.platform_fee} onChange={(v) => set('platform_fee', v)} />
            <NumberField label="Tax rate (%)" value={draft.tax_rate} onChange={(v) => set('tax_rate', v)} />
            <NumberField label="Waiting fee / min" value={draft.waiting_fee_per_minute} onChange={(v) => set('waiting_fee_per_minute', v)} />
            <NumberField label="Cancellation fee" value={draft.cancellation_fee} onChange={(v) => set('cancellation_fee', v)} />
            <NumberField label="Commission (%)" value={draft.driver_commission_percent} onChange={(v) => set('driver_commission_percent', v)} hint="Platform share, 0–100" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Zone ID (optional)</label>
              <Input placeholder="e.g. jaipur" value={draft.zone_id} onChange={(e) => set('zone_id', e.target.value)} />
              <p className="mt-1 text-[10px] text-neutral-400">Leave empty for the global/default rule.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">City (optional)</label>
              <Input placeholder="e.g. Jaipur" value={draft.city} onChange={(e) => set('city', e.target.value)} />
            </div>
          </div>
        </div>

        <PreviewPanel draft={draft} />
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate(payloadFromDraft(draft))}>
          {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}
        </Button>
      </div>
    </Modal>
  );
}

function NumberField({
  label,
  value,
  onChange,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <Input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[10px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function FareRuleViewModal({
  rule,
  open,
  onOpenChange,
}: {
  rule: AdminFareRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!rule) return null;

  const fields: { label: string; value: ReactNode }[] = [
    { label: 'Vehicle', value: rule.vehicle_type?.name ?? `#${rule.vehicle_type_id}` },
    { label: 'Zone', value: rule.zone_id || rule.city || 'Global' },
    { label: 'Base fare', value: money(rule.base_fare) },
    { label: 'Per KM', value: money(rule.per_km) },
    { label: 'Per minute', value: money(rule.per_minute) },
    { label: 'Minimum fare', value: money(rule.minimum_fare) },
    { label: 'Booking fee', value: money(rule.booking_fee ?? 0) },
    { label: 'Platform fee', value: money(rule.platform_fee ?? 0) },
    { label: 'Tax rate', value: `${num(rule.tax_rate) ?? 0}%` },
    { label: 'Waiting fee / min', value: money(rule.waiting_fee_per_minute ?? rule.waiting_charge_per_min ?? 0) },
    { label: 'Cancellation fee', value: money(rule.cancellation_fee ?? 0) },
    { label: 'Commission', value: `${num(rule.driver_commission_percent ?? 0)}%` },
    { label: 'Status', value: <StatusBadge status={rule.is_active ? 'active' : 'inactive'} /> },
  ];

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Fare rule · ${rule.vehicle_type?.name ?? `#${rule.id}`}`} description="Read-only view of the active configuration.">
      <div className="space-y-2.5">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-4 border-b border-ink-50 pb-2 text-sm last:border-0">
            <span className="text-neutral-500">{f.label}</span>
            <span className="font-medium text-neutral-900">{f.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

export function FareRulesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminFareRule | null>(null);
  const [viewing, setViewing] = useState<AdminFareRule | null>(null);

  const { data: vehicleTypes = [], isLoading: vtLoading, isError: vtError, refetch: vtRefetch } = useQuery({
    queryKey: ['admin-vehicle-types'],
    queryFn: () => settingsApi.vehicleTypes(),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-fare-rules'],
    queryFn: () => fareRulesApi.list(),
  });

  const rules = useMemo(() => {
    const rows = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.vehicle_type?.name ?? '').toLowerCase().includes(q) || (r.city ?? '').toLowerCase().includes(q));
  }, [data, query]);

  const toggleMutation = useMutation({
    mutationFn: (id: number) => fareRulesApi.toggle(id),
    onSuccess: (_d, id) => {
      toast('Fare rule status updated');
      void qc.invalidateQueries({ queryKey: ['admin-fare-rules'] });
      if (viewing?.id === id) void refetch();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fareRulesApi.remove(id),
    onSuccess: () => {
      toast('Fare rule deleted');
      void qc.invalidateQueries({ queryKey: ['admin-fare-rules'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (rule: AdminFareRule) => {
    setEditing(rule);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Fare Rules"
        description="Ride pricing per vehicle type. The Laravel fare engine reads these rules."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Search vehicle or city…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card className="overflow-x-auto px-0 py-0">
        {vtLoading || isLoading ? (
          <Skeleton className="p-6" />
        ) : vtError || isError || !data ? (
          <ErrorState onRetry={() => void (refetch(), vtRefetch())} />
        ) : (
          <Table>
            <THead>
              <THeadRow>
                <THeadCell>Vehicle</THeadCell>
                <THeadCell>Zone</THeadCell>
                <THeadCell>Base</THeadCell>
                <THeadCell>Per KM</THeadCell>
                <THeadCell>Per min</THeadCell>
                <THeadCell>Minimum</THeadCell>
                <THeadCell>Booking</THeadCell>
                <THeadCell>Platform</THeadCell>
                <THeadCell>Tax</THeadCell>
                <THeadCell>Commission</THeadCell>
                <THeadCell>Status</THeadCell>
                <THeadCell className="text-right">Actions</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {rules.map((r) => (
                <TRow key={r.id}>
                  <TCell>
                    <p className="font-medium text-neutral-900">{r.vehicle_type?.name ?? `#${r.vehicle_type_id}`}</p>
                    {r.vehicle_type?.code && <p className="text-xs text-neutral-400">{r.vehicle_type.code}</p>}
                  </TCell>
                  <TCell className="text-sm">{r.zone_id || r.city || 'Global'}</TCell>
                  <TCell className="text-sm">{money(r.base_fare)}</TCell>
                  <TCell className="text-sm">{money(r.per_km)}</TCell>
                  <TCell className="text-sm">{money(r.per_minute)}</TCell>
                  <TCell className="text-sm">{money(r.minimum_fare)}</TCell>
                  <TCell className="text-sm">{money(r.booking_fee ?? 0)}</TCell>
                  <TCell className="text-sm">{money(r.platform_fee ?? 0)}</TCell>
                  <TCell className="text-sm">{num(r.tax_rate) ?? 0}%</TCell>
                  <TCell className="text-sm">{num(r.driver_commission_percent ?? 0)}%</TCell>
                  <TCell>
                    <StatusBadge status={r.is_active ? 'active' : 'inactive'} />
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setViewing(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(r.id)}
                        title={r.is_active ? 'Disable' : 'Enable'}
                      >
                        <Power className={cn('h-4 w-4', r.is_active ? 'text-emerald-600' : 'text-neutral-400')} />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <FareRuleFormModal
        key={editing?.id ?? 'new-fare-rule'}
        editing={editing}
        open={formOpen}
        vehicleTypes={vehicleTypes}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      />

      <FareRuleViewModal rule={viewing} open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)} />
    </>
  );
}

export default FareRulesPage;