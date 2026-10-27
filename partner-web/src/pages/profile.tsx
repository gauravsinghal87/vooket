import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, Landmark, FileCheck, IdCard } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { driverApi, vehicleApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Field, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import type { DeliveryPartner, Driver, JobProfile, PartnerRole } from '@/typings/models';

const DRIVER_DOC_TYPES = ['license', 'insurance', 'rc', 'profile_photo', 'aadhar'] as const;

export function ProfilePage() {
  const role = useAuthStore((s) => s.role) as PartnerRole;
  const isDriver = role === 'driver';
  const keyPrefix = isDriver ? 'driver' : 'partner';
  const api = isDriver ? driverApi : partnerApi;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [`${keyPrefix}-profile`],
    queryFn: () => api.profile() as Promise<JobProfile>,
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const verified = (data as { is_verified?: boolean }).is_verified ?? false;

  return (
    <>
      <PageHeader
        title="Profile & KYC"
        description="Vehicle, licence and payout details"
        actions={<StatusBadge status={verified ? 'verified' : 'unverified'} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {isDriver ? <DriverForm data={data as Driver} /> : <PartnerForm data={data as DeliveryPartner} />}
        <div className="space-y-6">
          <BankForm />
          <DocumentsSection />
          <AccountCard />
        </div>
      </div>
    </>
  );
}

function DriverForm({ data }: { data: Driver }) {
  const qc = useQueryClient();
  const vehicleTypes = useQuery({ queryKey: ['vehicle-types'], queryFn: () => vehicleApi.list() });

  const [form, setForm] = useState<Record<string, string>>({});
  const hydrated = Object.keys(form).length > 0;

  const values = hydrated
    ? form
    : {
        vehicle_type_id: String(data.vehicle_type_id ?? ''),
        vehicle_number: data.vehicle_number ?? '',
        vehicle_model: data.vehicle_model ?? '',
        vehicle_color: data.vehicle_color ?? '',
        license_number: data.license_number ?? '',
        license_expiry: data.license_expiry ? String(data.license_expiry).slice(0, 10) : '',
        aadhar_number: data.aadhar_number ?? '',
        pan_number: data.pan_number ?? '',
      };

  const mutation = useMutation({
    mutationFn: () =>
      driverApi.update({
        vehicle_type_id: values.vehicle_type_id ? Number(values.vehicle_type_id) : undefined,
        vehicle_number: values.vehicle_number,
        vehicle_model: values.vehicle_model,
        vehicle_color: values.vehicle_color,
        license_number: values.license_number,
        license_expiry: values.license_expiry || undefined,
        aadhar_number: values.aadhar_number,
        pan_number: values.pan_number,
      }),
    onSuccess: () => {
      toast('Profile updated');
      setForm({});
      void qc.invalidateQueries({ queryKey: ['driver-profile'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <Car className="h-4 w-4 text-brand-600" /> Vehicle & licence
        </CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <Field label="Vehicle type">
          <Select value={values.vehicle_type_id} onChange={(e) => set('vehicle_type_id', e.target.value)}>
            <option value="">Select vehicle type</option>
            {(vehicleTypes.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle number">
            <Input value={values.vehicle_number} onChange={(e) => set('vehicle_number', e.target.value)} />
          </Field>
          <Field label="Colour">
            <Input value={values.vehicle_color} onChange={(e) => set('vehicle_color', e.target.value)} />
          </Field>
        </div>
        <Field label="Vehicle model">
          <Input value={values.vehicle_model} onChange={(e) => set('vehicle_model', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Licence number">
            <Input value={values.license_number} onChange={(e) => set('license_number', e.target.value)} />
          </Field>
          <Field label="Licence expiry">
            <Input type="date" value={values.license_expiry} onChange={(e) => set('license_expiry', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aadhaar number">
            <Input value={values.aadhar_number} onChange={(e) => set('aadhar_number', e.target.value)} />
          </Field>
          <Field label="PAN number">
            <Input value={values.pan_number} onChange={(e) => set('pan_number', e.target.value.toUpperCase())} className="uppercase" />
          </Field>
        </div>
        <Button disabled={!hydrated || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save vehicle details'}
        </Button>
      </div>
    </Card>
  );
}

function PartnerForm({ data }: { data: DeliveryPartner }) {
  const qc = useQueryClient();

  const [form, setForm] = useState<Record<string, string>>({});
  const hydrated = Object.keys(form).length > 0;

  const values = hydrated
    ? form
    : {
        vehicle_type: data.vehicle_type ?? 'bike',
        vehicle_number: data.vehicle_number ?? '',
        vehicle_model: data.vehicle_model ?? '',
        vehicle_color: data.vehicle_color ?? '',
        license_number: data.license_number ?? '',
        license_expiry: data.license_expiry ? String(data.license_expiry).slice(0, 10) : '',
        aadhar_number: data.aadhar_number ?? '',
      };

  const mutation = useMutation({
    mutationFn: () =>
      partnerApi.update({
        vehicle_type: values.vehicle_type,
        vehicle_number: values.vehicle_number,
        vehicle_model: values.vehicle_model,
        vehicle_color: values.vehicle_color,
        license_number: values.license_number,
        license_expiry: values.license_expiry || undefined,
        aadhar_number: values.aadhar_number,
      }),
    onSuccess: () => {
      toast('Profile updated');
      setForm({});
      void qc.invalidateQueries({ queryKey: ['partner-profile'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <Car className="h-4 w-4 text-brand-600" /> Vehicle & licence
        </CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <Field label="Vehicle type">
          <Select value={values.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)}>
            {['bike', 'scooter', 'bicycle', 'car'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle number">
            <Input value={values.vehicle_number} onChange={(e) => set('vehicle_number', e.target.value)} />
          </Field>
          <Field label="Colour">
            <Input value={values.vehicle_color} onChange={(e) => set('vehicle_color', e.target.value)} />
          </Field>
        </div>
        <Field label="Vehicle model">
          <Input value={values.vehicle_model} onChange={(e) => set('vehicle_model', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Licence number">
            <Input value={values.license_number} onChange={(e) => set('license_number', e.target.value)} />
          </Field>
          <Field label="Licence expiry">
            <Input type="date" value={values.license_expiry} onChange={(e) => set('license_expiry', e.target.value)} />
          </Field>
        </div>
        <Field label="Aadhaar number">
          <Input value={values.aadhar_number} onChange={(e) => set('aadhar_number', e.target.value)} />
        </Field>
        <Button disabled={!hydrated || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save vehicle details'}
        </Button>
      </div>
    </Card>
  );
}

function BankForm() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const isDriver = role === 'driver';
  const keyPrefix = isDriver ? 'driver' : 'partner';
  const { profile } = useAuthStore();

  const [form, setForm] = useState<Record<string, string>>({});
  const hydrated = Object.keys(form).length > 0;
  const values = hydrated
    ? form
    : {
        bank_account_name: (profile as { bank_account_name?: string | null })?.bank_account_name ?? '',
        bank_account_number: (profile as { bank_account_number?: string | null })?.bank_account_number ?? '',
        bank_ifsc: (profile as { bank_ifsc?: string | null })?.bank_ifsc ?? '',
        bank_name: (profile as { bank_name?: string | null })?.bank_name ?? '',
      };

  const mutation = useMutation({
    mutationFn: () =>
      (isDriver ? driverApi.updateBank(values) : partnerApi.updateBank(values)) as Promise<unknown>,
    onSuccess: () => {
      toast('Bank details saved');
      setForm({});
      void qc.invalidateQueries({ queryKey: [`${keyPrefix}-profile`] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
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
        <Button disabled={!hydrated || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save bank details'}
        </Button>
      </div>
    </Card>
  );
}

function DocumentsSection() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const isDriver = role === 'driver';
  const { profile } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('license');

  const existing = useMemo(() => {
    const docs = (profile as { documents?: { type: string; status: string }[] })?.documents ?? [];
    const seen = new Set<string>();
    docs.forEach((d) => seen.add(d.type));
    return [...seen];
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      (isDriver ? driverApi.uploadDocuments([{ type: docType, file: file! }]) : partnerApi.uploadDocuments([{ type: docType, file: file! }])) as Promise<
        unknown
      >,
    onSuccess: () => {
      toast('Document uploaded for verification');
      setFile(null);
      void qc.invalidateQueries({ queryKey: [`${isDriver ? 'driver' : 'partner'}-profile`] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Upload failed', 'error'),
  });

  return (
    <Card>
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-brand-600" /> Documents & KYC
        </CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {existing.length === 0 && <span className="text-sm text-neutral-400">No documents uploaded yet</span>}
          {existing.map((t) => (
            <span key={t} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {t}
            </span>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Document type">
            <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DRIVER_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-neutral-600">
            {file ? file.name : 'Choose file…'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <Button disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Uploading…' : 'Upload for verification'}
        </Button>
      </div>
    </Card>
  );
}

function AccountCard() {
  const { user, profile } = useAuthStore();
  const rating = (profile as { rating?: string | number | null })?.rating;
  return (
    <Card>
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-brand-600" /> Account
        </CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between border-b border-ink-100 pb-2">
          <span className="text-neutral-500">Name</span>
          <span className="font-medium text-neutral-900">{user?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between border-b border-ink-100 pb-2">
          <span className="text-neutral-500">Email</span>
          <span className="font-medium text-neutral-900">{user?.email ?? '—'}</span>
        </div>
        <div className="flex justify-between border-b border-ink-100 pb-2">
          <span className="text-neutral-500">Phone</span>
          <span className="font-medium text-neutral-900">{user?.phone ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Rating</span>
          <span className="font-medium text-neutral-900">{Number(rating ?? 0).toFixed(1)} ★</span>
        </div>
      </div>
    </Card>
  );
}