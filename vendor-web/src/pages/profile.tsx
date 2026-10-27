import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Landmark, IdCard, Image as ImageIcon, X, Clock } from 'lucide-react';
import { mapApi, outletsApi, profileApi } from '@/repositories/vendor';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Field, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { OutletLocationPicker } from '@/components/location/OutletLocationPicker';

function ImageUploader({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string;
  type: 'logo' | 'cover_image';
  onChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast('Image must be under 4 MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await profileApi.uploadImage(file, type);
      onChange(type === 'logo' ? res.logo ?? '' : res.cover_image ?? '');
      toast('Image uploaded');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt={label} className="h-16 w-16 rounded-xl border border-ink-100 object-cover" />
            <button
              type="button"
              title="Remove image"
              onClick={() => onChange('')}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50 text-neutral-400">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </Button>
        {value && <p className="text-xs text-neutral-400">Removing clears the saved image.</p>}
      </div>
    </Field>
  );
}

export function ProfilePage() {
  const qc = useQueryClient();
  const { profile: stored } = useAuthStore();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: () => profileApi.me(),
  });

  const { data: mapsConfig } = useQuery({
    queryKey: ['maps-config'],
    queryFn: () => mapApi.config(),
    staleTime: 5 * 60 * 1000,
  });
  const publicKey = mapsConfig?.public_key ?? null;

  const vendor = data?.vendor ?? stored?.vendor;
  const [form, setForm] = useState<Record<string, string>>({});
  const hydrated = Object.keys(form).length > 0;
  const values = hydrated
    ? form
    : {
        business_name: vendor?.business_name ?? '',
        owner_name: vendor?.owner_name ?? '',
        address: vendor?.address ?? '',
        latitude: vendor?.latitude == null ? '' : String(vendor.latitude),
        longitude: vendor?.longitude == null ? '' : String(vendor.longitude),
        gst_number: vendor?.gst_number ?? '',
        pan_number: vendor?.pan_number ?? '',
        fssai_number: vendor?.fssai_number ?? '',
        logo: vendor?.logo ?? '',
        cover_image: vendor?.cover_image ?? '',
        bank_account_name: vendor?.bank_account_name ?? '',
        bank_account_number: vendor?.bank_account_number ?? '',
        bank_ifsc: vendor?.bank_ifsc ?? '',
        bank_name: vendor?.bank_name ?? '',
      };

  const isRestaurant = vendor?.vendor_type === 'restaurant';

  // The restaurant's preparation time and operating hours live on its outlet,
  // so load the saved values from the outlets endpoint.
  const { data: outlets } = useQuery({
    queryKey: ['vendor-outlets'],
    queryFn: () => outletsApi.list(),
    enabled: !!vendor && vendor.vendor_type === 'restaurant',
  });
  const restaurantOutlet = outlets?.find((o) => o.type === 'restaurant');

  const toTimeInput = (value?: string | null) => (value ? value.slice(0, 5) : '');
  const [schedule, setSchedule] = useState<Record<string, string> | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});

  const scheduleValues = schedule ?? {
    avg_prep_time_min: restaurantOutlet?.avg_prep_time_min
      ? String(Math.round(Number(restaurantOutlet.avg_prep_time_min)))
      : '20',
    opens_at: toTimeInput(restaurantOutlet?.opens_at),
    closes_at: toTimeInput(restaurantOutlet?.closes_at),
  };

  const setScheduleField = (key: string, value: string) => {
    setSchedule((prev) => ({ ...(prev ?? scheduleValues), [key]: value }));
    setScheduleErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validateSchedule = (): Record<string, string> => {
    const next: Record<string, string> = {};
    const minutes = Number(scheduleValues.avg_prep_time_min);

    if (!scheduleValues.avg_prep_time_min.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      next.avg_prep_time_min = 'Enter a whole number of minutes between 1 and 180.';
    }
    if (!scheduleValues.opens_at) {
      next.opens_at = 'Opening time is required.';
    }
    if (!scheduleValues.closes_at) {
      next.closes_at = 'Closing time is required.';
    } else if (scheduleValues.opens_at && scheduleValues.opens_at === scheduleValues.closes_at) {
      next.closes_at = 'Closing time must be different from opening time.';
    }

    return next;
  };

  const handleSave = () => {
    if (isRestaurant) {
      const found = validateSchedule();
      setScheduleErrors(found);
      if (Object.keys(found).length > 0) {
        toast('Please fix the restaurant details', 'error');
        return;
      }
    }

    const payload: Record<string, unknown> = hydrated ? { ...values } : {};
    if (isRestaurant) {
      payload.avg_prep_time_min = Number(scheduleValues.avg_prep_time_min);
      payload.opens_at = scheduleValues.opens_at;
      payload.closes_at = scheduleValues.closes_at;
    }

    saveMutation.mutate(payload);
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => profileApi.update(payload),
    onSuccess: () => {
      toast('Profile updated');
      setForm({});
      setSchedule(null);
      void qc.invalidateQueries({ queryKey: ['vendor-profile'] });
      void qc.invalidateQueries({ queryKey: ['vendor-outlets'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError || !vendor) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="Profile & settings"
        description="Business information and payout details"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={vendor.status} />
            <Button onClick={handleSave} disabled={(!hydrated && !schedule) || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-600" /> Business
            </CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Field label="Business name">
              <Input value={values.business_name} onChange={(e) => set('business_name', e.target.value)} />
            </Field>
            <Field label="Owner name">
              <Input value={values.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
            </Field>
            <Field label="Address">
              <Textarea rows={2} value={values.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <OutletLocationPicker
              publicKey={publicKey}
              vendorType={vendor.vendor_type}
              latitude={values.latitude}
              longitude={values.longitude}
              address={values.address}
              onChange={set}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST number">
                <Input value={values.gst_number} onChange={(e) => set('gst_number', e.target.value)} />
              </Field>
              <Field label="PAN number">
                <Input value={values.pan_number} onChange={(e) => set('pan_number', e.target.value)} />
              </Field>
            </div>
            <Field label="FSSAI license (food only)">
              <Input value={values.fssai_number} onChange={(e) => set('fssai_number', e.target.value)} />
            </Field>
            <ImageUploader label="Business logo" value={values.logo} type="logo" onChange={(v) => set('logo', v)} />
            <ImageUploader label="Cover image" value={values.cover_image} type="cover_image" onChange={(v) => set('cover_image', v)} />
          </div>
        </Card>

        <div className="space-y-6">
          {isRestaurant && (
            <Card>
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-600" /> Restaurant details
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <Field
                  label="Average Food Preparation Time"
                  hint="How long your kitchen typically takes to prepare an order before it is ready for pickup."
                >
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    step={1}
                    inputMode="numeric"
                    value={scheduleValues.avg_prep_time_min}
                    onChange={(e) => setScheduleField('avg_prep_time_min', e.target.value)}
                    placeholder="20"
                  />
                  {scheduleErrors.avg_prep_time_min && (
                    <span className="mt-1.5 block text-xs font-medium text-red-500">
                      {scheduleErrors.avg_prep_time_min}
                    </span>
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Opening time">
                    <Input
                      type="time"
                      value={scheduleValues.opens_at}
                      onChange={(e) => setScheduleField('opens_at', e.target.value)}
                    />
                    {scheduleErrors.opens_at && (
                      <span className="mt-1.5 block text-xs font-medium text-red-500">{scheduleErrors.opens_at}</span>
                    )}
                  </Field>
                  <Field label="Closing time">
                    <Input
                      type="time"
                      value={scheduleValues.closes_at}
                      onChange={(e) => setScheduleField('closes_at', e.target.value)}
                    />
                    {scheduleErrors.closes_at && (
                      <span className="mt-1.5 block text-xs font-medium text-red-500">{scheduleErrors.closes_at}</span>
                    )}
                  </Field>
                </div>
                <p className="text-xs text-neutral-400">
                  Times use a 24-hour clock. For overnight service, set a closing time earlier than the opening time —
                  for example 18:00 to 02:00 means open through the night until 2 AM.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-brand-600" /> Payout bank details
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Field label="Account name">
                <Input value={values.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} />
              </Field>
              <Field label="Account number">
                <Input value={values.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="IFSC">
                  <Input value={values.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase())} className="font-mono uppercase" />
                </Field>
                <Field label="Bank name">
                  <Input value={values.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-brand-600" /> Account
              </CardTitle>
            </CardHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-ink-100 pb-2">
                <span className="text-neutral-500">Email</span>
                <span className="font-medium text-neutral-900">{data?.email ?? ''}</span>
              </div>
              <div className="flex justify-between border-b border-ink-100 pb-2">
                <span className="text-neutral-500">Phone</span>
                <span className="font-medium text-neutral-900">{data?.phone ?? '—'}</span>
              </div>
              <div className="flex justify-between border-b border-ink-100 pb-2">
                <span className="text-neutral-500">Business type</span>
                <span className="font-medium capitalize text-neutral-900">{vendor.vendor_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Platform commission</span>
                <span className="font-medium text-neutral-900">{Number(vendor.commission_rate)}%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}