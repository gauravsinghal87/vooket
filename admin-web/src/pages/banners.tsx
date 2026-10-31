import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Upload, Loader2, Play } from 'lucide-react';
import { bannersApi, restaurantsApi, storesApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AdminBanner } from '@/typings/models';

type MediaType = 'image' | 'video';

type BannerDraft = {
  title: string;
  subtitle: string;
  cta_text: string;
  image: string;
  media_type: MediaType;
  video: string;
  poster_image: string;
  position: string;
  service: string;
  placement: string;
  target_type: string;
  target_id: string;
  target_url: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  sort_order: string;
};

const emptyDraft: BannerDraft = {
  title: '',
  subtitle: '',
  cta_text: '',
  image: '',
  media_type: 'image',
  video: '',
  poster_image: '',
  position: 'home',
  service: 'food',
  placement: 'food_home_hero',
  target_type: '',
  target_id: '',
  target_url: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
  sort_order: '0',
};

/**
 * Human-readable names for every placement the customer app understands.
 * The service-specific "home hero" placements render on that service's page
 * only. The Food/Grocery promo-card and secondary placements no longer have a
 * surface and are kept for legacy records.
 */
const PLACEMENT_LABELS: Record<string, string> = {
  food_home_hero: 'Food home hero',
  grocery_home_hero: 'Grocery home hero',
  grocery_home_brand_promo: 'Grocery brand promo carousel',
  grocery_home_festive_promo: 'Grocery festive promo grid',
  order_tracking: 'Order tracking carousel',
  rides_home_hero: 'Rides home hero',
  rides_promotions: 'Rides promo cards (Everything in Minutes)',
  food_home_card: 'Food promo card (legacy)',
  grocery_home_card: 'Grocery promo card (legacy)',
  food_home_secondary: 'Food secondary banner (legacy)',
  grocery_home_secondary: 'Grocery secondary banner (legacy)',
};

/**
 * Placements kept in the schema only for legacy records. They have no surface in
 * the customer app, so a banner saved to one of these will never render.
 */
const PLACEMENT_NO_SURFACE = new Set([
  'food_home_card',
  'grocery_home_card',
  'food_home_secondary',
  'grocery_home_secondary',
]);

const placementLabel = (placement?: string | null): string | null =>
  placement ? PLACEMENT_LABELS[placement] ?? placement : null;

const PLACEMENT_GROUPS: { label: string; values: string[] }[] = [
  {
    label: 'Service pages',
    values: [
      'food_home_hero',
      'grocery_home_hero',
      'grocery_home_brand_promo',
      'grocery_home_festive_promo',
      'order_tracking',
      'rides_home_hero',
      'rides_promotions',
    ],
  },
  { label: 'Legacy', values: ['food_home_card', 'grocery_home_card', 'food_home_secondary', 'grocery_home_secondary'] },
];

const toLocalInput = (iso?: string | null): string => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const TARGET_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  store: 'Store',
  product: 'Product',
  category: 'Category',
  url: 'URL',
  search: 'Search',
  service: 'Service',
};

/**
 * A friendly, service-aware model of where a banner takes the customer.
 *
 * The right target depends on the chosen Promotion service: Food promos point
 * at a Restaurant (picked from the real list) or the Food page, Grocery promos
 * at a Grocery store or the Grocery page, Rides promos at the Ride booking page
 * and General promos at a custom destination. Each choice maps onto the
 * banner's existing target_type / target_id / target_url fields, so no
 * database concept changes.
 */
type TargetChoice = 'none' | 'url' | 'restaurant' | 'store' | 'url-food' | 'url-grocery' | 'url-rides' | 'advanced';

const SERVICE_TARGET_CHOICES: Record<string, { value: TargetChoice; label: string }[]> = {
  all: [
    { value: 'none', label: 'No target' },
    { value: 'url', label: 'Custom URL' },
    { value: 'advanced', label: 'Advanced…' },
  ],
  food: [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'url-food', label: 'Food page' },
    { value: 'url', label: 'Custom URL' },
    { value: 'advanced', label: 'Advanced…' },
  ],
  grocery: [
    { value: 'store', label: 'Grocery store' },
    { value: 'url-grocery', label: 'Grocery page' },
    { value: 'url', label: 'Custom URL' },
    { value: 'advanced', label: 'Advanced…' },
  ],
  rides: [
    { value: 'url-rides', label: 'Ride page' },
    { value: 'url', label: 'Custom URL' },
    { value: 'advanced', label: 'Advanced…' },
  ],
};

const DEFAULT_TARGET_CHOICE: Record<string, TargetChoice> = {
  all: 'none',
  food: 'restaurant',
  grocery: 'store',
  rides: 'url-rides',
};

const TARGET_HINTS: Record<TargetChoice, string> = {
  none: 'No destination — the promo is not tappable.',
  restaurant: 'Tapping the promo opens the chosen restaurant page.',
  store: 'Tapping the promo opens the chosen grocery store page.',
  'url-food': 'Tapping the promo opens the Food page.',
  'url-grocery': 'Tapping the promo opens the Grocery page.',
  'url-rides': 'Tapping the promo opens the Ride booking page.',
  url: 'Absolute URL or an in-app route such as /rides.',
  advanced: 'Raw target type (product, category, search…).',
};

function currentTargetChoice(d: BannerDraft): TargetChoice {
  if (d.target_type === 'restaurant') return 'restaurant';
  if (d.target_type === 'store') return 'store';
  if (d.target_type === 'url') {
    if (d.target_url === '/food') return 'url-food';
    if (d.target_url === '/grocery') return 'url-grocery';
    if (d.target_url === '/rides') return 'url-rides';
    return 'url';
  }
  if (d.target_type === '' && d.target_id === '' && d.target_url === '') return 'none';
  return 'advanced';
}

function applyTargetChoice(d: BannerDraft, choice: TargetChoice): BannerDraft {
  switch (choice) {
    case 'none':
      return { ...d, target_type: '', target_id: '', target_url: '' };
    case 'restaurant':
      return { ...d, target_type: 'restaurant', target_url: '' };
    case 'store':
      return { ...d, target_type: 'store', target_url: '' };
    case 'url-food':
      return { ...d, target_type: 'url', target_url: '/food' };
    case 'url-grocery':
      return { ...d, target_type: 'url', target_url: '/grocery' };
    case 'url-rides':
      return { ...d, target_type: 'url', target_url: '/rides' };
    case 'url':
      return { ...d, target_type: 'url' };
    case 'advanced':
      return d;
  }
}

function targetChoiceForService(d: BannerDraft, service: string): TargetChoice {
  const choices = SERVICE_TARGET_CHOICES[service] ?? SERVICE_TARGET_CHOICES.all;
  const current = currentTargetChoice(d);
  return choices.some((o) => o.value === current) ? current : DEFAULT_TARGET_CHOICE[service] ?? 'none';
}

function draftFromBanner(b: AdminBanner): BannerDraft {
  return {
    title: b.title ?? '',
    subtitle: b.subtitle ?? '',
    cta_text: b.cta_text ?? '',
    image: b.image ?? '',
    media_type: (b.media_type as MediaType | null | undefined) ?? 'image',
    video: b.video ?? '',
    poster_image: b.poster_image ?? '',
    position: b.position ?? 'home',
    service: b.service ?? 'all',
    placement: b.placement && PLACEMENT_LABELS[b.placement] ? b.placement : 'food_home_hero',
    target_type: b.target_type ?? 'url',
    target_id: b.target_id ? String(b.target_id) : '',
    target_url: b.target_url ?? '',
    starts_at: toLocalInput(b.starts_at),
    expires_at: toLocalInput(b.expires_at),
    is_active: Boolean(b.is_active),
    sort_order: String(b.sort_order ?? 0),
  };
}

function UploadDropzone({
  uploading,
  icon,
  title,
  hint,
  onClick,
}: {
  uploading: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={uploading}
      onClick={onClick}
      className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-300 text-neutral-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600 disabled:opacity-50"
    >
      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      <span className="text-sm font-medium">{uploading ? 'Uploading…' : title}</span>
      <span className="text-xs text-neutral-400">{hint}</span>
    </button>
  );
}

function MediaField({
  label,
  hint,
  value,
  uploading,
  onUpload,
  onChange,
  onError,
  accept,
  maxBytes,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<{ url: string }>;
  onChange: (url: string) => void;
  onError: (message: string) => void;
  accept: string;
  maxBytes: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith(accept.startsWith('video') ? 'video/' : 'image/')) {
      onError(accept.startsWith('video') ? 'Please choose a video file' : 'Please choose an image file');
      return;
    }
    if (file.size > maxBytes) {
      onError(`File must be smaller than ${Math.round(maxBytes / (1024 * 1024))}MB`);
      return;
    }
    try {
      const res = await onUpload(file);
      onChange(res.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          {accept.startsWith('video') ? (
            <video src={value} muted playsInline preload="metadata" className="h-20 w-28 shrink-0 rounded-lg bg-ink-950 object-cover" />
          ) : (
            <img src={value} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">Stored URL. You can also paste a URL below.</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  'Replace'
                )}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
                <Trash2 className="h-4 w-4 text-red-500" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <UploadDropzone
          uploading={uploading}
          icon={<Upload className="h-5 w-5" />}
          title={`Upload ${hint.split(' · ')[0].toLowerCase()}`}
          hint={hint}
          onClick={() => fileRef.current?.click()}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function BannerPreview({ draft }: { draft: BannerDraft }) {
  const hasMedia = Boolean(draft.image || draft.video);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Mobile hero preview</span>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink-100 bg-ink-950">
        {draft.media_type === 'video' && draft.video ? (
          <video src={draft.video} muted autoPlay loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : draft.image ? (
          <img src={draft.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-white/40">No media yet</span>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 p-3.5">
          {hasMedia && draft.cta_text && (
            <span className="mb-2 inline-block rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-900 backdrop-blur">
              {draft.cta_text}
            </span>
          )}
          {hasMedia && draft.title && (
            <span className="block text-lg font-extrabold leading-tight text-white drop-shadow-sm">{draft.title}</span>
          )}
          {hasMedia && draft.subtitle && (
            <span className="mt-0.5 block line-clamp-1 text-xs leading-snug text-white/75">{draft.subtitle}</span>
          )}
        </span>
      </div>
    </div>
  );
}

function BannerFormModal({
  editing,
  open,
  onOpenChange,
}: {
  editing: AdminBanner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<BannerDraft>(() => (editing ? draftFromBanner(editing) : emptyDraft));
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) return bannersApi.update(editing.id, body);
      return bannersApi.create(body);
    },
    onSuccess: () => {
      toast(editing ? 'Banner updated' : 'Banner created');
      void qc.invalidateQueries({ queryKey: ['admin-banners'] });
      onOpenChange(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = <K extends keyof BannerDraft>(key: K, value: BannerDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const restaurantOptions = useQuery({
    queryKey: ['admin-restaurant-options'],
    queryFn: () => restaurantsApi.list({ per_page: 500 }),
    enabled: draft.target_type === 'restaurant',
  });
  const storeOptions = useQuery({
    queryKey: ['admin-store-options'],
    queryFn: () => storesApi.list({ per_page: 500 }),
    enabled: draft.target_type === 'store',
  });

  const onServiceChange = (service: string) => {
    const next = { ...draft, service };
    const choice = targetChoiceForService(next, service);
    setDraft(applyTargetChoice(next, choice));
  };

  const onPlacementChange = (placement: string) => {
    set('placement', placement);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await bannersApi.uploadImage(file);
      setDraft((d) => ({ ...d, image: res.image }));
      return { url: res.image };
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const uploadPoster = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await bannersApi.uploadImage(file);
      setDraft((d) => ({ ...d, poster_image: res.image }));
      return { url: res.image };
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const uploadVideo = async (file: File) => {
    setUploadingVideo(true);
    setUploadError(null);
    try {
      const res = await bannersApi.uploadVideo(file);
      setDraft((d) => ({ ...d, video: res.video, media_type: 'video' }));
      return { url: res.video };
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    } finally {
      setUploadingVideo(false);
    }
  };

  const submit = () => {
    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      image: draft.image.trim(),
      media_type: draft.media_type,
      is_active: draft.is_active,
      sort_order: Number(draft.sort_order || 0),
    };
    if (draft.subtitle) body.subtitle = draft.subtitle.trim();
    if (draft.cta_text) body.cta_text = draft.cta_text.trim();
    if (draft.position) body.position = draft.position;
    if (draft.service) body.service = draft.service;
    if (draft.placement) body.placement = draft.placement;
    if (draft.video) body.video = draft.video.trim();
    if (draft.poster_image) body.poster_image = draft.poster_image.trim();
    if (draft.target_type) body.target_type = draft.target_type;
    body.target_id = draft.target_id ? Number(draft.target_id) : null;
    body.target_url = draft.target_url?.trim() ? draft.target_url.trim() : null;
    if (draft.starts_at) body.starts_at = draft.starts_at;
    if (draft.expires_at) body.expires_at = draft.expires_at;
    saveMutation.mutate(body);
  };

  const canSave =
    draft.title.trim().length > 0 &&
    draft.image.trim().length > 0 &&
    (draft.media_type !== 'video' || draft.video.trim().length > 0);

  const isVideo = draft.media_type === 'video';

  const choice = targetChoiceForService(draft, draft.service);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? `Edit banner · ${editing.title}` : 'New banner'}
      description="Service page banners"
    >
      <div className="space-y-4">
        {uploadError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{uploadError}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Title</label>
            <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Subtitle</label>
            <Input value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">CTA text</label>
            <Input
              placeholder="Order now"
              value={draft.cta_text}
              onChange={(e) => set('cta_text', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Media type</label>
            <div className="flex gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1">
              {(['image', 'video'] as MediaType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('media_type', t)}
                  className={cn(
                    'tap flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium capitalize transition-all',
                    draft.media_type === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  )}
                >
                  {t === 'video' && <Play className="h-3 w-3" />}
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MediaField
          label={isVideo ? 'Poster / fallback image' : 'Image'}
          hint="PNG, JPG or WebP · up to 4MB"
          value={draft.image}
          uploading={uploading}
          accept="image/*"
          maxBytes={4 * 1024 * 1024}
          onUpload={uploadImage}
          onChange={(url) => set('image', url)}
          onError={(msg) => setUploadError(msg)}
        />

        {isVideo && (
          <>
            <MediaField
              label="Video"
              hint="MP4, WebM or MOV · up to 24MB"
              value={draft.video}
              uploading={uploadingVideo}
              accept="video/*"
              maxBytes={24 * 1024 * 1024}
              onUpload={uploadVideo}
              onChange={(url) => set('video', url)}
              onError={(msg) => setUploadError(msg)}
            />
            <MediaField
              label="Poster image (shown while video loads)"
              hint="PNG, JPG or WebP · up to 4MB"
              value={draft.poster_image}
              uploading={uploading}
              accept="image/*"
              maxBytes={4 * 1024 * 1024}
              onUpload={uploadPoster}
              onChange={(url) => set('poster_image', url)}
              onError={(msg) => setUploadError(msg)}
            />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Promotion service</label>
            <Select value={draft.service} onChange={(e) => onServiceChange(e.target.value)}>
              <option value="all">General</option>
              <option value="food">Food</option>
              <option value="grocery">Grocery</option>
              <option value="rides">Rides</option>
            </Select>
            <p className="mt-1 text-xs text-neutral-500">
              {draft.service === 'all'
                ? 'General promos are not tied to a single service and only render in service-specific placements.'
                : 'Promos for this service — shown with its chip and target service page.'}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Placement</label>
            <Select value={draft.placement} onChange={(e) => onPlacementChange(e.target.value)}>
              {PLACEMENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.values.map((value) => (
                    <option key={value} value={value}>
                      {PLACEMENT_LABELS[value]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <p className="mt-1 text-xs text-neutral-500">
              Service placements render on that service page; the order tracking carousel renders on Food and Grocery
              order tracking screens.
            </p>
            {PLACEMENT_NO_SURFACE.has(draft.placement) && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                This placement is legacy and no longer renders on any customer page — the banner will not be visible.
                Choose a Service page placement instead.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Sort order</label>
            <Input
              type="number"
              min="0"
              value={draft.sort_order}
              onChange={(e) => set('sort_order', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-ink-100 p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Target destination</label>
              <Select
                value={choice}
                onChange={(e) => setDraft(applyTargetChoice(draft, e.target.value as TargetChoice))}
              >
                {(SERVICE_TARGET_CHOICES[draft.service] ?? SERVICE_TARGET_CHOICES.all).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-neutral-500">{TARGET_HINTS[choice]}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Position (legacy)</label>
              <Select value={draft.position} onChange={(e) => set('position', e.target.value)}>
                <option value="home">Home</option>
                <option value="food">Food</option>
                <option value="grocery">Grocery</option>
                <option value="rides">Rides</option>
                <option value="promo">Promo</option>
              </Select>
            </div>
          </div>

          {choice === 'restaurant' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Restaurant</label>
              <Select value={draft.target_id} onChange={(e) => set('target_id', e.target.value)}>
                <option value="">Choose a restaurant…</option>
                {restaurantOptions.data?.data.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </Select>
              {restaurantOptions.isLoading && <p className="mt-1 text-xs text-neutral-400">Loading restaurants…</p>}
            </div>
          )}

          {choice === 'store' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Grocery store</label>
              <Select value={draft.target_id} onChange={(e) => set('target_id', e.target.value)}>
                <option value="">Choose a store…</option>
                {storeOptions.data?.data.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {storeOptions.isLoading && <p className="mt-1 text-xs text-neutral-400">Loading stores…</p>}
            </div>
          )}

          {choice === 'url' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Target URL</label>
              <Input
                placeholder="https://example.com/promo or /rides"
                value={draft.target_url}
                onChange={(e) => set('target_url', e.target.value)}
              />
            </div>
          )}

          {choice === 'advanced' && (
            <div className="grid gap-3 rounded-lg border border-ink-100 bg-ink-50/40 p-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Target type</label>
                <Select value={draft.target_type} onChange={(e) => set('target_type', e.target.value)}>
                  <option value="">None</option>
                  <option value="url">URL</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="store">Store</option>
                  <option value="product">Product</option>
                  <option value="category">Category</option>
                </Select>
              </div>
              {draft.target_type === 'url' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Target URL</label>
                  <Input
                    placeholder="https://example.com or /rides"
                    value={draft.target_url}
                    onChange={(e) => set('target_url', e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Target ID</label>
                  <Input
                    type="number"
                    placeholder={`${draft.target_type || 'target'} ID`}
                    value={draft.target_id}
                    onChange={(e) => set('target_id', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Starts at</label>
            <Input type="datetime-local" value={draft.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Expires at</label>
            <Input type="datetime-local" value={draft.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
          </div>
        </div>

        <label
          className={cn(
            'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3',
            draft.is_active ? 'border-brand-500 bg-brand-50' : 'border-ink-100'
          )}
        >
          <span>
            <span className="block text-sm font-medium text-neutral-800">Active</span>
            <span className="block text-xs text-neutral-400">Visible on the selected placement.</span>
          </span>
          <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
        </label>

        <BannerPreview draft={draft} />

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave || saveMutation.isPending} onClick={submit}>
            {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create banner'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function BannersPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => bannersApi.list({ per_page: 100 }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => bannersApi.toggle(id),
    onSuccess: () => {
      toast('Banner updated');
      void qc.invalidateQueries({ queryKey: ['admin-banners'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bannersApi.remove(id),
    onSuccess: () => {
      toast('Banner deleted');
      void qc.invalidateQueries({ queryKey: ['admin-banners'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (b: AdminBanner) => {
    setEditing(b);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Banners"
        description="Service page banners"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New banner
          </Button>
        }
      />

      <Card className="px-0 py-0">
        {isLoading ? (
          <Skeleton className="p-6" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <Table>
            <THead>
              <THeadRow>
                <THeadCell>Banner</THeadCell>
                <THeadCell>Placement</THeadCell>
                <THeadCell>Target</THeadCell>
                <THeadCell>Sort</THeadCell>
                <THeadCell>Status</THeadCell>
                <THeadCell className="text-right">Actions</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {data.data.map((b) => (
                <TRow key={b.id}>
                  <TCell>
                    <div className="flex items-center gap-3">
                      {b.media_type === 'video' && b.video ? (
                        <video src={b.video} muted playsInline preload="metadata" className="h-12 w-20 rounded-lg bg-ink-950 object-cover" />
                      ) : b.image ? (
                        <img src={b.image} alt={b.title} className="h-12 w-20 rounded-lg object-cover" />
                      ) : (
                        <span className="inline-flex h-12 w-20 items-center justify-center rounded-lg bg-ink-50 text-xs text-neutral-400">No media</span>
                      )}
                      <div>
                        <p className="font-semibold text-neutral-900">{b.title}</p>
                        {b.subtitle && <p className="text-xs text-neutral-400">{b.subtitle}</p>}
                      </div>
                    </div>
                  </TCell>
                  <TCell>
                    <p className="text-sm">{placementLabel(b.placement) ?? b.position ?? '—'}</p>
                    <p className="text-xs text-neutral-400">{b.service ?? 'all'} · {b.media_type ?? 'image'}</p>
                  </TCell>
                  <TCell>
                    <p className="text-xs text-neutral-600">
                      {b.target_type ? TARGET_TYPE_LABELS[b.target_type] ?? b.target_type : '—'}
                      {b.target_id ? ` · #${b.target_id}` : ''}
                    </p>
                    {b.target_url && (
                      <a href={b.target_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                        {b.target_url}
                      </a>
                    )}
                  </TCell>
                  <TCell>{b.sort_order}</TCell>
                  <TCell>
                    <StatusBadge status={b.is_active ? 'active' : 'inactive'} />
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant={b.is_active ? 'outline' : 'success'}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(b.id)}
                      >
                        {b.is_active ? 'Hide' : 'Show'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(b.id)}>
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

      <BannerFormModal
        key={editing?.id ?? 'new-banner'}
        editing={editing}
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      />
    </>
  );
}