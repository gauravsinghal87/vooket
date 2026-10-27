import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { settingsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import type { AdminSetting } from '@/typings/models';

type GroupDraft = Record<number, string | boolean>;

/**
 * Food and Grocery delivery prices are configured per destination zone in the
 * dedicated Zone Delivery Configuration module. Their legacy global setting
 * groups stay in the database for reference/backfill, but are intentionally not
 * editable here so an operator cannot mistake them for live pricing.
 */
const DELIVERY_CONFIG_GROUPS = new Set([
  'food_delivery',
  'grocery_delivery',
  'grocery_scheduled_delivery',
  'partner_delivery',
]);

function rowValue(setting: AdminSetting): string | boolean {
  if (setting.type === 'boolean') return setting.value === '1' || setting.value === 'true';
  return setting.value ?? '';
}

function serializeValue(setting: AdminSetting, draft: string | boolean): string {
  if (setting.type === 'boolean') return draft ? '1' : '0';
  return String(draft);
}

const series = (v: string | boolean | undefined): string => {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return v ?? '';
};

/**
 * A single generic settings input. The platform logo has its own dedicated
 * upload control below.
 */
function SettingField({ setting, value, onDraft }: {
  setting: AdminSetting;
  value: string | boolean | undefined;
  onDraft: (id: number, value: string | boolean) => void;
}) {
  const label = setting.label || setting.key;

  if (setting.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-800">{label}</p>
          {setting.key !== label && <p className="font-mono text-[10px] text-neutral-400">{setting.key}</p>}
        </div>
        <button
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => onDraft(setting.id, !value)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-neutral-300'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
    );
  }

  if (setting.type === 'select' && setting.options?.length) {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
        <Select value={String(value)} onChange={(e) => onDraft(setting.id, e.target.value)}>
          {setting.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        {setting.help_text && <p className="mt-1 text-xs text-neutral-500">{setting.help_text}</p>}
        {setting.key !== label && <p className="mt-1 font-mono text-[10px] text-neutral-400">{setting.key}</p>}
      </div>
    );
  }

  if (setting.type === 'json' || setting.type === 'array') {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
        <Textarea
          rows={4}
          value={String(value)}
          onChange={(e) => onDraft(setting.id, e.target.value)}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-neutral-400">{setting.type} — raw value (JSON / comma-separated)</p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      <Input
        type={setting.type === 'number' ? 'number' : 'text'}
        value={String(value)}
        onChange={(e) => onDraft(setting.id, e.target.value)}
      />
      {setting.help_text && <p className="mt-1 text-xs text-neutral-500">{setting.help_text}</p>}
      {setting.key !== label && <p className="mt-1 font-mono text-[10px] text-neutral-400">{setting.key}</p>}
    </div>
  );
}

function useSaveSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: { id: number; value: string }[]) => {
      for (const row of rows) {
        await settingsApi.update(row.id, row.value);
      }
    },
    onSuccess: () => {
      toast('Settings saved');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });
}

const LOGO_ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Platform Logo upload control.
 *
 * The logo is uploaded and persisted immediately through the authenticated
 * `POST /admin/settings/logo` endpoint (the same settings API the rest of the
 * page uses) rather than riding the generic text-field Save button, because the
 * value is a stored file instead of a typed string. The old file is replaced
 * server-side; removing the logo clears the setting and deletes the file.
 */
function PlatformLogoField({ setting }: { setting: AdminSetting }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  // `savedPreview` holds the persisted value (survives reloads); `localPreview`
  // shows the newly picked file instantly, before the server upload finishes.
  const [savedPreview, setSavedPreview] = useState<string | null>(setting.value);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Release the temporary object URL when the field unmounts.
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!LOGO_ACCEPT_TYPES.includes(file.type)) {
        throw new Error('Please choose a PNG, JPG or WebP image');
      }
      if (file.size > LOGO_MAX_BYTES) {
        throw new Error('Logo must be smaller than 2MB');
      }
      return settingsApi.uploadLogo(file);
    },
    onSuccess: (updated) => {
      setSavedPreview(updated.value);
      setLocalPreview(null);
      toast('Logo uploaded. It now appears across the customer apps.');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => {
      // Revert to the last saved logo when the upload is rejected.
      setLocalPreview(null);
      toast(err instanceof Error ? err.message : 'Logo upload failed', 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => settingsApi.removeLogo(),
    onSuccess: (updated) => {
      setSavedPreview(updated.value);
      setLocalPreview(null);
      toast('Logo removed. The initials fallback is used.');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not remove the logo', 'error'),
  });

  const busy = uploadMutation.isPending || removeMutation.isPending;
  const shownPreview = localPreview ?? savedPreview;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Platform Logo</span>
      <div className="flex items-center gap-4 rounded-xl border border-ink-200 p-3">
        {shownPreview ? (
          <img
            src={shownPreview}
            alt="Platform logo preview"
            className="h-14 w-14 shrink-0 rounded-2xl bg-ink-100 object-contain ring-1 ring-ink-200"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 font-black text-white shadow-sm">
            SB
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs text-neutral-400">{setting.help_text ?? 'Square logo shown in the customer header.'}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {savedPreview || localPreview ? 'Replace' : 'Upload logo'}
                </>
              )}
            </Button>
            {savedPreview && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => removeMutation.mutate()}>
                {removeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                ) : (
                  <Trash2 className="h-4 w-4 text-red-500" />
                )}{' '}
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-neutral-400">Shown in real time across the customer web and mobile apps.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            const objectUrl = URL.createObjectURL(file);
            objectUrlRef.current = objectUrl;
            setLocalPreview(objectUrl);
            uploadMutation.mutate(file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

function SaveButton({ settings, drafts }: { settings: AdminSetting[]; drafts: GroupDraft }) {
  const saveMutation = useSaveSettings();
  // The platform logo has its own dedicated upload control and is never part of
  // the text-draft save flow; otherwise an empty draft would overwrite the
  // persisted logo URL whenever the admin saved any other setting.
  const dirty = settings.filter((s) => s.key !== 'platform_logo' && series(drafts[s.id]) !== s.value);
  const hasChanges = dirty.length > 0;

  return (
    <Button
      size="sm"
      disabled={!hasChanges || saveMutation.isPending}
      onClick={() => saveMutation.mutate(dirty.map((s) => ({ id: s.id, value: serializeValue(s, drafts[s.id]) })))}
    >
      {saveMutation.isPending ? 'Saving…' : `Save ${dirty.length > 0 ? dirty.length : ''}`.trim()}
    </Button>
  );
}

function SettingsGroupCard({ group, settings, drafts, onDraft }: {
  group: string;
  settings: AdminSetting[];
  drafts: GroupDraft;
  onDraft: (id: number, value: string | boolean) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 px-0 pt-0">
        <CardTitle className="capitalize">{group.replace(/_/g, ' ')}</CardTitle>
        <SaveButton settings={settings} drafts={drafts} />
      </CardHeader>
      <div className="space-y-4">
        {settings
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) =>
            s.key === 'platform_logo' ? (
              <PlatformLogoField key={s.id} setting={s} />
            ) : (
              <SettingField key={s.id} setting={s} value={drafts[s.id]} onDraft={onDraft} />
            )
          )}
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const [drafts, setDrafts] = useState<Record<number, string | boolean>>({});

  const { data: settingsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsApi.list(undefined),
  });

  const rows = useMemo(() => settingsData?.data ?? [], [settingsData]);

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<number, string | boolean> = { ...prev };
      for (const s of rows) {
        if (!(s.id in next)) next[s.id] = rowValue(s);
      }
      return next;
    });
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const s of rows) {
      const g = s.group || 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return map;
  }, [rows]);

  const otherGroups = useMemo(
    () => Array.from(grouped.entries()).filter(([group]) => !DELIVERY_CONFIG_GROUPS.has(group)),
    [grouped]
  );

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const onDraft = (id: number, value: string | boolean) => setDrafts((prev) => ({ ...prev, [id]: value }));

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration" />

      {rows.length === 0 ? (
        <ErrorState message="No app settings found. Check backend/database/seeders/ConfigurationSeeder.php" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2 border-brand-100 bg-brand-50/40">
            <CardHeader className="px-0 pt-0">
              <div>
                <CardTitle>Delivery pricing moved</CardTitle>
                <CardDescription>
                  Food, Grocery Instant and Grocery Scheduled delivery prices are now configured per destination zone.
                  Edit them in{' '}
                  <Link className="font-medium text-brand-700 underline" to="/zone-delivery-configurations">
                    Zone Delivery Configuration
                  </Link>
                  . The legacy global values are kept only as reference and for the one-time zone backfill.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          {otherGroups.map(([group, settings]) => (
            <SettingsGroupCard
              key={group}
              group={group}
              settings={settings}
              drafts={drafts}
              onDraft={onDraft}
            />
          ))}
        </div>
      )}
    </>
  );
}
