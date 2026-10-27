import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Truck,
  Undo2,
} from 'lucide-react';
import { zonesApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type ModuleTab = 'food' | 'grocery';
type GroceryMode = 'instant' | 'scheduled';
type ScheduledType = 'free' | 'chargeable';

type Drafts = Record<string, string>;

/**
 * The admin API deliberately uses the same column-style field names for its
 * save payload and its GET response. These are not the pricing calculator
 * aliases (`per_km`, `free_above`, ...).
 */
type EditableConfigValues = Partial<Record<NumericField, number | string | null>> & {
  delivery_type?: ScheduledType | null;
};

type ConfigBlock = {
  module: string;
  delivery_mode: string;
  configured: boolean;
  saved: boolean;
  values: EditableConfigValues;
  global: EditableConfigValues;
  updated_at?: string | null;
};

const NUMERIC_FIELDS = [
  'delivery_fee_per_km',
  'delivery_fee_paid_by_admin_per_km',
  'free_delivery_above',
  'free_delivery_km',
  'delivery_gst_percent',
  'partner_free_distance_earning',
  'packaging_charge',
  'handling_fee',
  'admin_fee_per_parcel',
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];

const FIELD_LABELS: Record<NumericField, string> = {
  delivery_fee_per_km: 'Delivery Fee per KM',
  delivery_fee_paid_by_admin_per_km: 'Delivery Fee Paid by Admin per KM',
  free_delivery_above: 'Free Delivery Above',
  free_delivery_km: 'Free Delivery Within (KM)',
  delivery_gst_percent: 'Delivery GST %',
  partner_free_distance_earning: 'Partner Earning for Free Delivery Distance',
  packaging_charge: 'Packaging Charge',
  handling_fee: 'Handling Fee',
  admin_fee_per_parcel: 'Admin Fee per Parcel',
};

const HINTS: Partial<Record<NumericField, string>> = {
  delivery_fee_per_km: 'Customer-facing charge for every chargeable kilometre.',
  delivery_fee_paid_by_admin_per_km: 'Amount funded by the platform per kilometre. Also drives partner earnings.',
  free_delivery_above: 'Leave blank for no order-value threshold.',
  free_delivery_km: 'Leave blank for no distance allowance. Maximum 200 km.',
  delivery_gst_percent: 'Applied to the delivery fee only. 0–100.',
  partner_free_distance_earning: 'Guaranteed partner earning for the free-distance allowance.',
  packaging_charge: 'Flat customer-facing charge added to each order.',
  handling_fee: 'Flat customer-facing charge added to each order.',
  admin_fee_per_parcel: 'Flat amount paid by the platform per scheduled parcel. 0 is valid.',
};

function mapValues(source: EditableConfigValues | undefined): Drafts {
  const mapped: Drafts = {};
  for (const field of NUMERIC_FIELDS) {
    const value = source?.[field];
    mapped[field] = value === null || value === undefined ? '' : String(value);
  }
  const type = source?.delivery_type;
  if (type === 'free' || type === 'chargeable') mapped.delivery_type = type;
  return mapped;
}

function isScheduledFreeTab(moduleTab: ModuleTab, groceryMode: GroceryMode, scheduledType: ScheduledType): boolean {
  return moduleTab === 'grocery' && groceryMode === 'scheduled' && scheduledType === 'free';
}

function visibleFields(
  moduleTab: ModuleTab,
  groceryMode: GroceryMode,
  scheduledFree: boolean
): NumericField[] {
  if (scheduledFree) {
    return ['admin_fee_per_parcel', 'packaging_charge', 'handling_fee'];
  }

  const fields: NumericField[] = [
    'delivery_fee_per_km',
    'delivery_fee_paid_by_admin_per_km',
    'free_delivery_above',
    'free_delivery_km',
    'delivery_gst_percent',
  ];

  if (moduleTab === 'food' || (moduleTab === 'grocery' && groceryMode === 'scheduled')) {
    fields.push('packaging_charge', 'handling_fee');
  }

  fields.push('partner_free_distance_earning');

  return fields;
}

function requiredFields(
  moduleTab: ModuleTab,
  groceryMode: GroceryMode,
  scheduledFree: boolean
): NumericField[] {
  if (scheduledFree) {
    return ['admin_fee_per_parcel', 'packaging_charge', 'handling_fee'];
  }

  const fields: NumericField[] = [
    'delivery_fee_per_km',
    'delivery_fee_paid_by_admin_per_km',
    'delivery_gst_percent',
    'partner_free_distance_earning',
  ];

  if (moduleTab === 'food' || (moduleTab === 'grocery' && groceryMode === 'scheduled')) {
    fields.push('packaging_charge', 'handling_fee');
  }

  return fields;
}

function validateDrafts(
  drafts: Drafts,
  moduleTab: ModuleTab,
  groceryMode: GroceryMode,
  scheduledFree: boolean
): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = new Set(requiredFields(moduleTab, groceryMode, scheduledFree));
  const visible = new Set(visibleFields(moduleTab, groceryMode, scheduledFree));

  for (const field of NUMERIC_FIELDS) {
    if (!visible.has(field)) continue;

    const raw = (drafts[field] ?? '').trim();

    if (raw === '') {
      if (required.has(field)) {
        errors[field] = 'Required. Enter 0 when there is no charge.';
      }
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      errors[field] = 'Enter a valid number.';
      continue;
    }

    if (value < 0) {
      errors[field] = 'Must be 0 or greater.';
      continue;
    }

    if (field === 'delivery_gst_percent' && value > 100) {
      errors[field] = 'GST cannot exceed 100%.';
    }

    if (field === 'free_delivery_km' && value > 200) {
      errors[field] = 'Free delivery distance cannot exceed 200 km.';
    }
  }

  if (moduleTab === 'grocery' && groceryMode === 'scheduled' && !drafts.delivery_type) {
    errors.delivery_type = 'Select Free Delivery or Chargeable Delivery.';
  }

  return errors;
}

function formatSavedAt(value?: string | null): string {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not saved yet';

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ZoneDeliveryConfigurationsPage() {
  const qc = useQueryClient();
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [moduleTab, setModuleTab] = useState<ModuleTab>('food');
  const [groceryMode, setGroceryMode] = useState<GroceryMode>('instant');
  const [scheduledType, setScheduledType] = useState<ScheduledType>('chargeable');
  const [drafts, setDrafts] = useState<Drafts>({});
  const [initial, setInitial] = useState<Drafts>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hydratedKey = useRef<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['zone-delivery-status'],
    queryFn: () => zonesApi.deliveryConfigs.status(),
  });

  const zones = useMemo(() => statusQuery.data?.zones ?? [], [statusQuery.data?.zones]);
  const missingCount = statusQuery.data?.missing_count ?? 0;

  const configQuery = useQuery({
    queryKey: ['zone-delivery-config', selectedZoneId],
    queryFn: () => zonesApi.deliveryConfigs.get(Number(selectedZoneId)),
    enabled: !!selectedZoneId,
  });

  const configData = configQuery.data as
    | { zone?: { id: number; name: string; is_active?: boolean }; configs?: Record<string, ConfigBlock> }
    | undefined;

  const blockKey =
    moduleTab === 'food' ? 'food' : groceryMode === 'instant' ? 'grocery_instant' : 'grocery_scheduled';

  const block = configData?.configs?.[blockKey];
  const selectedZone = zones.find((zone) => String(zone.id) === selectedZoneId);
  const scheduledFree = isScheduledFreeTab(moduleTab, groceryMode, scheduledType);
  const isScheduled = moduleTab === 'grocery' && groceryMode === 'scheduled';
  const configured = !!block?.configured;
  const savedButIncomplete = !!block?.saved && !configured;
  const needsActivation = !configured;

  // Auto-select the first zone so the module is usable immediately, but never
  // override a zone the administrator has already chosen.
  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) {
      setSelectedZoneId(String(zones[0].id));
    }
  }, [selectedZoneId, zones]);

  // Hydrate drafts only from the exact saved block for this zone/module/mode.
  // Missing rows deliberately show global REFERENCE values, never active values.
  // A background refetch must not overwrite edits in progress, so each
  // zone/module/mode combination is hydrated once (or after an explicit refresh).
  useEffect(() => {
    if (!configData || !selectedZoneId) return;
    if (configData.zone && configData.zone.id !== Number(selectedZoneId)) return;

    const key = `${selectedZoneId}:${blockKey}`;
    if (hydratedKey.current === key) return;

    const current = configData.configs?.[blockKey];
    if (!current) return;

    const source = current.saved ? current.values : current.global;
    const mapped = mapValues(source);

    if (blockKey === 'grocery_scheduled') {
      const type = mapped.delivery_type === 'free' ? 'free' : 'chargeable';
      mapped.delivery_type = type;
      setScheduledType(type);
    } else {
      delete mapped.delivery_type;
    }

    setDrafts(mapped);
    setInitial(mapped);
    setErrors({});
    hydratedKey.current = key;
  }, [configData, selectedZoneId, blockKey]);

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(drafts), ...Object.keys(initial)]);
    for (const key of keys) {
      if ((drafts[key] ?? '') !== (initial[key] ?? '')) return true;
    }

    return false;
  }, [drafts, initial]);

  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);

    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['zone-delivery-status'] }),
      selectedZoneId
        ? qc.invalidateQueries({ queryKey: ['zone-delivery-config', selectedZoneId] })
        : Promise.resolve(),
      qc.invalidateQueries({ queryKey: ['admin-zones'] }),
      qc.invalidateQueries({ queryKey: ['admin-zones-select'] }),
    ]);
  };

  const backfillMutation = useMutation({
    mutationFn: () => zonesApi.deliveryConfigs.backfill(false),
    onSuccess: async (result: any) => {
      const created = Number(result?.created ?? 0);
      const incomplete = Number(result?.incomplete_existing ?? 0);
      toast(
        created > 0
          ? `${created} missing configuration${created === 1 ? '' : 's'} initialized from global values.`
          : 'No missing configuration rows to initialize.',
        created > 0 ? 'success' : 'info'
      );
      if (incomplete > 0) {
        toast(
          `${incomplete} saved configuration${incomplete === 1 ? ' is' : 's are'} incomplete and still need attention.`,
          'error'
        );
      }
      await refreshAll();
    },
    onError: (err: any) => toast(err?.message || 'Failed to initialize zone configurations', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedZoneId) throw new Error('Select a zone first.');

      const nextErrors = validateDrafts(drafts, moduleTab, groceryMode, scheduledFree);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        throw new Error('Fix the highlighted fields before saving.');
      }

      const module = moduleTab === 'food' ? 'food' : 'grocery';
      const deliveryMode = moduleTab === 'food' ? 'standard' : groceryMode;
      const payload: Record<string, unknown> = { module, delivery_mode: deliveryMode };

      // Send every numeric field, including the Scheduled type's currently
      // hidden fields. The backend merges missing keys anyway, but sending the
      // full draft makes switching Free <-> Chargeable deterministic and keeps
      // the hidden values visible again when the operator switches back.
      for (const field of NUMERIC_FIELDS) {
        const raw = (drafts[field] ?? '').trim();
        payload[field] = raw === '' ? null : Number(raw);
      }

      payload.delivery_type = deliveryMode === 'scheduled' ? scheduledType : null;

      return zonesApi.deliveryConfigs.upsert(Number(selectedZoneId), payload);
    },
    onSuccess: async (result: any) => {
      const values = result?.values;
      if (values) {
        const mapped = mapValues(values);
        if (blockKey === 'grocery_scheduled') {
          const type = mapped.delivery_type === 'free' ? 'free' : 'chargeable';
          mapped.delivery_type = type;
          setScheduledType(type);
        } else {
          delete mapped.delivery_type;
        }
        setDrafts(mapped);
        setInitial(mapped);
      } else if (block) {
        setInitial(drafts);
      }

      setErrors({});
      toast('Zone delivery configuration saved and active');
      await refreshAll();
    },
    onError: (err: any) => {
      const serverErrors = err?.errors as Record<string, string[]> | undefined;
      if (serverErrors) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(serverErrors)) {
          if (Array.isArray(messages) && messages.length > 0) mapped[key] = messages[0];
        }
        setErrors(mapped);
      }
      toast(err?.message || 'Failed to save zone configuration', 'error');
    },
  });

  const changeZone = (value: string) => {
    if (dirty && !window.confirm('You have unsaved changes. Switch zone and discard them?')) return;
    setSelectedZoneId(value);
    setDrafts({});
    setInitial({});
    setErrors({});
  };

  const changeModule = (value: ModuleTab) => {
    if (dirty && !window.confirm('You have unsaved changes. Switch module and discard them?')) return;
    setModuleTab(value);
    setDrafts({});
    setInitial({});
    setErrors({});
  };

  const changeGroceryMode = (value: GroceryMode) => {
    if (dirty && !window.confirm('You have unsaved changes. Switch delivery mode and discard them?')) return;
    setGroceryMode(value);
    setDrafts({});
    setInitial({});
    setErrors({});
  };

  const changeScheduledType = (value: ScheduledType) => {
    setScheduledType(value);
    setDrafts((previous) => ({ ...previous, delivery_type: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next.delivery_type;
      delete next.admin_fee_per_parcel;
      return next;
    });
  };

  const loadGlobalReference = () => {
    if (!block) return;
    const mapped = mapValues(block.global);
    if (blockKey === 'grocery_scheduled') {
      const type = mapped.delivery_type === 'free' ? 'free' : 'chargeable';
      mapped.delivery_type = type;
      setScheduledType(type);
    } else {
      delete mapped.delivery_type;
    }
    setDrafts(mapped);
    setErrors({});
    toast('Global reference values loaded into the form. Save to activate them for this zone.', 'info');
  };

  const discardChanges = () => {
    if (blockKey === 'grocery_scheduled') {
      setScheduledType(initial.delivery_type === 'free' ? 'free' : 'chargeable');
    }
    setDrafts(initial);
    setErrors({});
  };

  const setField = (field: string, value: string) => {
    setDrafts((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const fields = visibleFields(moduleTab, groceryMode, scheduledFree);
  const required = new Set(requiredFields(moduleTab, groceryMode, scheduledFree));

  if (statusQuery.isLoading) {
    return (
      <>
        <PageHeader
          title="Zone Delivery Configuration"
          description="Mandatory Food and Grocery delivery pricing for every service zone"
        />
        <Skeleton className="py-10" />
      </>
    );
  }

  if (statusQuery.isError) {
    return (
      <>
        <PageHeader
          title="Zone Delivery Configuration"
          description="Mandatory Food and Grocery delivery pricing for every service zone"
        />
        <ErrorState
          message="Could not load zone delivery configuration status."
          onRetry={() => void statusQuery.refetch()}
        />
      </>
    );
  }

  if (zones.length === 0) {
    return (
      <>
        <PageHeader
          title="Zone Delivery Configuration"
          description="Mandatory Food and Grocery delivery pricing for every service zone"
        />
        <Card>
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-8 text-center">
            <Truck className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-3 text-sm font-medium text-neutral-700">No service zones yet</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-neutral-500">
              Delivery pricing is configured per destination zone. Create the first service zone, then return
              here to save its Food, Grocery Instant and Grocery Scheduled configuration.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-medium text-brand-700 underline"
              to="/zones"
            >
              Go to Service Zones
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Zone Delivery Configuration"
        description="Food and Grocery delivery are priced only from the destination zone. Global values are reference/backfill inputs, never a live fallback."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              hydratedKey.current = null;
              void statusQuery.refetch();
              if (selectedZoneId) void configQuery.refetch();
            }}
            loading={statusQuery.isFetching || configQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {missingCount > 0 ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">
                  {missingCount} zone{missingCount === 1 ? '' : 's'} need delivery configuration
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Customers cannot complete Food or Grocery checkout in these zones until a complete
                  configuration is saved. Initialize missing rows from the current global reference values,
                  then review each zone.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              loading={backfillMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Copy current global Food/Grocery values into every zone with no saved configuration? Existing and incomplete rows will not be overwritten.'
                  )
                ) {
                  backfillMutation.mutate();
                }
              }}
            >
              <Truck className="h-4 w-4" /> Initialize missing rows
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center gap-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>Every zone has a complete Food, Grocery Instant, and Grocery Scheduled configuration.</p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="px-0 pt-0">
          <div>
            <CardTitle>Delivery pricing by destination zone</CardTitle>
            <CardDescription>
              Values are saved separately for each zone and module. Zero is a valid saved value.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-end">
          <Field label="Delivery zone" hint="The customer's delivery address resolves to this zone.">
            <Select value={selectedZoneId} onChange={(event) => changeZone(event.target.value)}>
              <option value="">Select a zone…</option>
              {zones.map((zone) => {
                const missing = zone.missing.length;
                return (
                  <option key={zone.id} value={String(zone.id)}>
                    {zone.name}
                    {zone.code ? ` (${zone.code})` : ''}
                    {missing > 0 ? ` — ${missing} setup required` : ' — configured'}
                  </option>
                );
              })}
            </Select>
          </Field>

          {selectedZone ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge tone={selectedZone.is_active ? 'success' : 'neutral'}>
                {selectedZone.is_active ? 'Active zone' : 'Inactive zone'}
              </Badge>
              {selectedZone.missing.length === 0 ? (
                <Badge tone="success">All modules configured</Badge>
              ) : (
                <Badge tone="warning">
                  {selectedZone.missing.length} module{selectedZone.missing.length === 1 ? '' : 's'} need
                  setup
                </Badge>
              )}
              {savedButIncomplete ? <Badge tone="danger">Incomplete saved row</Badge> : null}
            </div>
          ) : null}
        </div>

        {!selectedZoneId ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-8 text-center">
            <Truck className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-3 text-sm font-medium text-neutral-700">Select a zone to configure delivery</p>
            <p className="mt-1 text-sm text-neutral-500">
              Zones without a complete configuration are marked as setup required and cannot price checkout.
            </p>
          </div>
        ) : (
          <>
            <div
              className="mb-4 flex flex-wrap items-center gap-1 border-b border-ink-100"
              role="tablist"
              aria-label="Delivery module"
            >
              <TabButton active={moduleTab === 'food'} onClick={() => changeModule('food')}>
                Food
              </TabButton>
              <TabButton active={moduleTab === 'grocery'} onClick={() => changeModule('grocery')}>
                Grocery
              </TabButton>
            </div>

            {moduleTab === 'grocery' ? (
              <div
                className="mb-4 flex flex-wrap gap-1"
                role="tablist"
                aria-label="Grocery delivery mode"
              >
                <TabButton
                  active={groceryMode === 'instant'}
                  onClick={() => changeGroceryMode('instant')}
                  subtle
                >
                  Instant Delivery
                </TabButton>
                <TabButton
                  active={groceryMode === 'scheduled'}
                  onClick={() => changeGroceryMode('scheduled')}
                  subtle
                >
                  Scheduled Delivery
                </TabButton>
              </div>
            ) : null}

            {isScheduled ? (
              <div className="mb-5 max-w-md">
                <Field
                  label="Scheduled Delivery Type"
                  hint="Switching the type changes what this zone charges for scheduled orders."
                >
                  <Select
                    value={scheduledType}
                    disabled={saveMutation.isPending}
                    onChange={(event) => changeScheduledType(event.target.value as ScheduledType)}
                  >
                    <option value="chargeable">Chargeable Delivery</option>
                    <option value="free">Free Delivery (paid by Admin per parcel)</option>
                  </Select>
                </Field>
                {errors.delivery_type ? (
                  <p className="mt-1 text-xs text-red-600">{errors.delivery_type}</p>
                ) : null}
              </div>
            ) : null}

            {configQuery.isLoading ? (
              <Skeleton className="py-8" rows={5} />
            ) : configQuery.isError ? (
              <ErrorState
                message="Could not load this zone's delivery configuration."
                onRetry={() => void configQuery.refetch()}
              />
            ) : (
              <>
                <div
                  className={cn(
                    'mb-5 rounded-xl border p-4 text-sm',
                    configured
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {configured ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span className="font-semibold">
                      {configured
                        ? 'Saved and active'
                        : savedButIncomplete
                          ? 'Saved configuration is incomplete'
                          : 'Setup required'}
                    </span>
                    <span className="text-xs opacity-80">Last saved: {formatSavedAt(block?.updated_at)}</span>
                  </div>
                  {!configured ? (
                    <p className="mt-1.5 text-sm">
                      {savedButIncomplete
                        ? 'This zone has a saved row but it is missing required Scheduled details. Complete it below to enable pricing.'
                        : 'This zone has no saved configuration. The values below are the current global reference values and are not used for customer pricing until you save them.'}
                    </p>
                  ) : null}
                  {selectedZone && !selectedZone.is_active ? (
                    <p className="mt-1.5 text-sm">
                      This zone is inactive. The configuration is saved, but the zone will not be offered to
                      customers until it is activated in Service zones.
                    </p>
                  ) : null}
                </div>

                {Object.keys(errors).length > 0 ? (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Fix the highlighted fields before saving.
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field}>
                      <Field
                        label={FIELD_LABELS[field]}
                        required={required.has(field)}
                        hint={HINTS[field]}
                      >
                        <Input
                          inputMode="decimal"
                          value={drafts[field] ?? ''}
                          disabled={saveMutation.isPending}
                          aria-invalid={!!errors[field]}
                          className={cn(errors[field] && 'border-red-300 focus:border-red-500 focus:ring-red-100')}
                          onChange={(event) => setField(field, event.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      {errors[field] ? <p className="mt-1 text-xs text-red-600">{errors[field]}</p> : null}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {!configured ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saveMutation.isPending}
                        onClick={loadGlobalReference}
                      >
                        <RefreshCw className="h-4 w-4" /> Load global reference values
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saveMutation.isPending || !dirty}
                      onClick={discardChanges}
                    >
                      <Undo2 className="h-4 w-4" /> Discard changes
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {configured && !dirty ? (
                      <span className="text-xs text-neutral-500">No unsaved changes</span>
                    ) : null}
                    {dirty || needsActivation ? (
                      <span className="text-xs text-amber-700">Unsaved changes</span>
                    ) : null}
                    <Button
                      type="button"
                      disabled={
                        saveMutation.isPending || !selectedZoneId || (configured && !dirty)
                      }
                      onClick={() => saveMutation.mutate()}
                    >
                      {saveMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {configured ? 'Save changes' : 'Activate configuration'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function TabButton({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? subtle
            ? 'bg-brand-50 text-brand-700'
            : 'border-b-2 border-brand-600 text-brand-700'
          : 'text-neutral-500 hover:bg-ink-50 hover:text-neutral-800'
      )}
    >
      {children}
    </button>
  );
}
