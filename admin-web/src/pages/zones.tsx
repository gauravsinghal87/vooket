import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { mapsApi, zonesApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ZonePolygonEditor } from '@/components/zones/ZonePolygonEditor';
import { cn } from '@/lib/utils';
import type { AdminZone, AdminZonePolygonPoint } from '@/typings/models';

const PER_PAGE = 25;

type ZoneDraft = {
  name: string;
  code: string;
  description: string;
  city: string;
  state: string;
  type: string;
  priority: string;
  is_active: boolean;
  food_enabled: boolean;
  grocery_enabled: boolean;
  ride_enabled: boolean;
  center_latitude: string;
  center_longitude: string;
  radius_km: string;
  food_partner_search_radius_km: string;
  grocery_partner_search_radius_km: string;
  ride_driver_search_radius_km: string;
  allow_cross_zone_food_delivery: boolean;
  allow_cross_zone_grocery_delivery: boolean;
  allow_ride_drop_outside_zone: boolean;
  polygon: AdminZonePolygonPoint[];
};

const ZONE_TYPES = ['delivery', 'ride', 'service_area', 'multi'] as const;

function emptyDraft(): ZoneDraft {
  return {
    name: '',
    code: '',
    description: '',
    city: '',
    state: '',
    type: 'multi',
    priority: '0',
    is_active: true,
    food_enabled: true,
    grocery_enabled: true,
    ride_enabled: true,
    center_latitude: '',
    center_longitude: '',
    radius_km: '25',
    food_partner_search_radius_km: '',
    grocery_partner_search_radius_km: '',
    ride_driver_search_radius_km: '',
    allow_cross_zone_food_delivery: false,
    allow_cross_zone_grocery_delivery: false,
    allow_ride_drop_outside_zone: false,
    polygon: [],
  };
}

function str(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function draftFromZone(zone: AdminZone): ZoneDraft {
  return {
    name: zone.name ?? '',
    code: zone.code ?? '',
    description: zone.description ?? '',
    city: zone.city ?? '',
    state: zone.state ?? '',
    type: zone.type ?? 'multi',
    priority: str(zone.priority ?? 0),
    is_active: zone.is_active !== false,
    food_enabled: zone.food_enabled === true,
    grocery_enabled: zone.grocery_enabled === true,
    ride_enabled: zone.ride_enabled === true,
    center_latitude: str(zone.center_latitude),
    center_longitude: str(zone.center_longitude),
    radius_km: str(zone.radius_km),
    food_partner_search_radius_km: str(zone.food_partner_search_radius_km),
    grocery_partner_search_radius_km: str(zone.grocery_partner_search_radius_km),
    ride_driver_search_radius_km: str(zone.ride_driver_search_radius_km),
    allow_cross_zone_food_delivery: zone.allow_cross_zone_food_delivery === true,
    allow_cross_zone_grocery_delivery: zone.allow_cross_zone_grocery_delivery === true,
    allow_ride_drop_outside_zone: zone.allow_ride_drop_outside_zone === true,
    polygon: Array.isArray(zone.polygon) ? zone.polygon : [],
  };
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function payloadFromDraft(draft: ZoneDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: draft.name.trim(),
    code: draft.code.trim() || null,
    description: draft.description.trim() || null,
    city: draft.city.trim() || null,
    state: draft.state.trim() || null,
    type: draft.type,
    priority: optionalNumber(draft.priority) ?? 0,
    is_active: draft.is_active,
    food_enabled: draft.food_enabled,
    grocery_enabled: draft.grocery_enabled,
    ride_enabled: draft.ride_enabled,
    center_latitude: optionalNumber(draft.center_latitude),
    center_longitude: optionalNumber(draft.center_longitude),
    radius_km: optionalNumber(draft.radius_km),
    food_partner_search_radius_km: optionalNumber(draft.food_partner_search_radius_km),
    grocery_partner_search_radius_km: optionalNumber(draft.grocery_partner_search_radius_km),
    ride_driver_search_radius_km: optionalNumber(draft.ride_driver_search_radius_km),
    allow_cross_zone_food_delivery: draft.allow_cross_zone_food_delivery,
    allow_cross_zone_grocery_delivery: draft.allow_cross_zone_grocery_delivery,
    allow_ride_drop_outside_zone: draft.allow_ride_drop_outside_zone,
    polygon: draft.polygon.length >= 3 ? draft.polygon : null,
  };
  return body;
}

function ServiceBadges({ zone }: { zone: AdminZone }) {
  const services = [
    { key: 'food', enabled: zone.food_enabled, tone: 'info' as const },
    { key: 'grocery', enabled: zone.grocery_enabled, tone: 'accent' as const },
    { key: 'ride', enabled: zone.ride_enabled, tone: 'violet' as const },
  ];
  const enabled = services.filter((s) => s.enabled);
  if (enabled.length === 0) return <span className="text-xs text-neutral-400">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {enabled.map((s) => (
        <Badge key={s.key} tone={s.tone}>
          {s.key}
        </Badge>
      ))}
    </div>
  );
}

function CountCell({ value }: { value?: number }) {
  return <span className="tabular-nums text-sm text-neutral-700">{value ?? 0}</span>;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5',
        checked ? 'border-emerald-400 bg-emerald-50' : 'border-ink-100'
      )}
    >
      <span>
        <span className="block text-sm font-medium text-neutral-800">{label}</span>
        {hint && <span className="block text-[10px] text-neutral-400">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[10px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function ZoneFormModal({
  open,
  onOpenChange,
  editing,
  publicKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminZone | null;
  publicKey: string | null;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ZoneDraft>(() => (editing ? draftFromZone(editing) : emptyDraft()));
  const [activeTab, setActiveTab] = useState<'basics' | 'coverage' | 'boundary'>('basics');

  useEffect(() => {
    setDraft(editing ? draftFromZone(editing) : emptyDraft());
    setActiveTab('basics');
  }, [editing, open]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => (editing ? zonesApi.update(editing.id, body) : zonesApi.create(body)),
    onSuccess: () => {
      toast(editing ? 'Zone updated' : 'Zone created');
      void qc.invalidateQueries({ queryKey: ['admin-zones'] });
      onOpenChange(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = <K extends keyof ZoneDraft>(key: K, value: ZoneDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const center = useMemo(() => {
    const latitude = optionalNumber(draft.center_latitude);
    const longitude = optionalNumber(draft.center_longitude);
    return latitude !== null && longitude !== null ? { latitude, longitude } : null;
  }, [draft.center_latitude, draft.center_longitude]);

  const canSave = draft.name.trim() !== '' && !saveMutation.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? `Zone · ${editing.name}` : 'New service zone'}
      description="Service area, enabled services and geofence boundary enforced by the backend."
    >
      <div className="mb-4 flex gap-1 rounded-xl bg-ink-50 p-1">
        {(['basics', 'coverage', 'boundary'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition',
              activeTab === tab ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'basics' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Zone name<span className="text-red-500"> *</span>
            </label>
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Jaipur Central" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Code</label>
            <Input value={draft.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. JAI-CENTRAL" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Zone type</label>
            <Select value={draft.type} onChange={(e) => set('type', e.target.value)}>
              {ZONE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">City</label>
            <Input value={draft.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">State</label>
            <Input value={draft.state} onChange={(e) => set('state', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Description</label>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Internal notes about this zone"
            />
          </div>
          <div>
            <NumberField label="Priority" value={draft.priority} onChange={(v) => set('priority', v)} hint="Higher wins when zones overlap" />
          </div>
          <div className="flex items-end">
            <ToggleRow
              label={draft.is_active ? 'Active' : 'Inactive'}
              hint="Inactive zones are ignored by serviceability checks"
              checked={draft.is_active}
              onChange={(v) => set('is_active', v)}
            />
          </div>
        </div>
      )}

      {activeTab === 'coverage' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow label="Food" checked={draft.food_enabled} onChange={(v) => set('food_enabled', v)} />
            <ToggleRow label="Grocery" checked={draft.grocery_enabled} onChange={(v) => set('grocery_enabled', v)} />
            <ToggleRow label="Ride" checked={draft.ride_enabled} onChange={(v) => set('ride_enabled', v)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Centre latitude" value={draft.center_latitude} onChange={(v) => set('center_latitude', v)} />
            <NumberField label="Centre longitude" value={draft.center_longitude} onChange={(v) => set('center_longitude', v)} />
            <NumberField label="Radius (km)" value={draft.radius_km} onChange={(v) => set('radius_km', v)} hint="Used when no polygon is drawn" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Food search radius (km)"
              value={draft.food_partner_search_radius_km}
              onChange={(v) => set('food_partner_search_radius_km', v)}
            />
            <NumberField
              label="Grocery search radius (km)"
              value={draft.grocery_partner_search_radius_km}
              onChange={(v) => set('grocery_partner_search_radius_km', v)}
            />
            <NumberField
              label="Ride search radius (km)"
              value={draft.ride_driver_search_radius_km}
              onChange={(v) => set('ride_driver_search_radius_km', v)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow
              label="Cross-zone food"
              checked={draft.allow_cross_zone_food_delivery}
              onChange={(v) => set('allow_cross_zone_food_delivery', v)}
            />
            <ToggleRow
              label="Cross-zone grocery"
              checked={draft.allow_cross_zone_grocery_delivery}
              onChange={(v) => set('allow_cross_zone_grocery_delivery', v)}
            />
            <ToggleRow
              label="Ride drop outside zone"
              checked={draft.allow_ride_drop_outside_zone}
              onChange={(v) => set('allow_ride_drop_outside_zone', v)}
            />
          </div>
        </div>
      )}

      {activeTab === 'boundary' && (
        <div className="space-y-3">
          <ZonePolygonEditor
            publicKey={publicKey}
            center={center}
            value={draft.polygon}
            onChange={(points) => set('polygon', points)}
          />
          <p className="text-xs text-neutral-500">
            The polygon takes precedence over the radius. A boundary needs at least 3 points, otherwise the circular radius is used.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canSave} onClick={() => saveMutation.mutate(payloadFromDraft(draft))}>
          {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create zone'}
        </Button>
      </div>
    </Modal>
  );
}

export function ZonesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminZone | null>(null);

  const mapsQuery = useQuery({
    queryKey: ['maps-config'],
    queryFn: () => mapsApi.config(),
    staleTime: 5 * 60 * 1000,
  });
  const publicKey = mapsQuery.data?.public_key ?? null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-zones', { page, query }],
    queryFn: () => zonesApi.list({ page, per_page: PER_PAGE, search: query.trim() || null }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => zonesApi.toggleStatus(id),
    onSuccess: () => {
      toast('Zone status updated');
      void qc.invalidateQueries({ queryKey: ['admin-zones'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => zonesApi.remove(id),
    onSuccess: () => {
      toast('Zone deleted');
      void qc.invalidateQueries({ queryKey: ['admin-zones'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const zones = data?.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (zone: AdminZone) => {
    setEditing(zone);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Service Zones"
        description="Geofenced service areas that decide which customers, vendors and partners can operate."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New zone
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search zone, city or code…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-x-auto px-0 py-0">
        {isLoading ? (
          <Skeleton className="p-6" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : zones.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">No zones match your search.</div>
        ) : (
          <Table>
            <THead>
              <THeadRow>
                <THeadCell>Zone</THeadCell>
                <THeadCell>Status</THeadCell>
                <THeadCell>Services</THeadCell>
                <THeadCell>Restaurants</THeadCell>
                <THeadCell>Stores</THeadCell>
                <THeadCell>Food partners</THeadCell>
                <THeadCell>Grocery partners</THeadCell>
                <THeadCell>Drivers</THeadCell>
                <THeadCell>Delivery config</THeadCell>
                <THeadCell>Priority</THeadCell>
                <THeadCell className="text-right">Actions</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {zones.map((zone) => (
                <TRow key={zone.id}>
                  <TCell>
                    <p className="font-medium text-neutral-900">{zone.name}</p>
                    <p className="text-xs text-neutral-400">
                      {[zone.code, zone.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </TCell>
                  <TCell>
                    <Badge tone={zone.is_active ? 'success' : 'neutral'}>{zone.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TCell>
                  <TCell>
                    <ServiceBadges zone={zone} />
                  </TCell>
                  <TCell>
                    <CountCell value={zone.restaurant_count} />
                  </TCell>
                  <TCell>
                    <CountCell value={zone.store_count} />
                  </TCell>
                  <TCell>
                    <CountCell value={zone.online_food_partners} />
                  </TCell>
                  <TCell>
                    <CountCell value={zone.online_grocery_partners} />
                  </TCell>
                  <TCell>
                    <CountCell value={zone.online_drivers} />
                  </TCell>
                  <TCell>
                    {(zone.delivery_configs_count ?? 0) === 0 ? (
                      <Badge tone="danger">Setup required</Badge>
                    ) : (
                      <Badge tone={(zone.delivery_configs_count ?? 0) >= 3 ? 'success' : 'warning'}>
                        {zone.delivery_configs_count}/3 configured
                      </Badge>
                    )}
                  </TCell>
                  <TCell>
                    <span className="tabular-nums text-sm text-neutral-700">{zone.priority ?? 0}</span>
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(zone)} title="Edit zone">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(zone.id)}
                        title={zone.is_active ? 'Disable' : 'Enable'}
                      >
                        <Power className={cn('h-4 w-4', zone.is_active ? 'text-emerald-600' : 'text-neutral-400')} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        title="Delete zone"
                        onClick={() => {
                          if (window.confirm(`Delete zone ${zone.name}?`)) deleteMutation.mutate(zone.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
        {data && !isLoading && !isError && (
          <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
        )}
      </Card>

      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
        <MapPin className="h-3.5 w-3.5" />
        {publicKey ? 'Google Maps connected — polygon editor available.' : 'Google Maps browser key not configured; boundary editing is disabled.'}
      </div>

      <ZoneFormModal
        key={editing?.id ?? 'new-zone'}
        open={formOpen}
        editing={editing}
        publicKey={publicKey}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      />
    </>
  );
}

export default ZonesPage;
