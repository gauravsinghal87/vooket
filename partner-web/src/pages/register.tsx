import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CarTaxiFront, Bike, UtensilsCrossed, ShoppingBasket, ArrowRight, ArrowLeft } from 'lucide-react';
import { authApi, type PartnerRegistrationPayload } from '@/repositories/auth';
import { vehicleApi, zonesApi } from '@/repositories/driver';
import { Input, Select, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { VehicleType, Zone } from '@/typings/models';

type Role = 'driver' | 'delivery_partner';
type DeliveryServiceType = 'food' | 'grocery';

const EMPTY: PartnerRegistrationPayload = {
  role: 'delivery_partner',
  name: '',
  email: '',
  phone: '',
  password: '',
  country_code: '+91',
  service_type: 'food',
  zone_id: null,
  vehicle_number: '',
  vehicle_model: '',
  vehicle_color: '',
  license_number: '',
  license_expiry: '',
  aadhar_number: '',
  pan_number: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  bank_name: '',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<PartnerRegistrationPayload>(EMPTY);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    vehicleApi
      .list()
      .then(setVehicleTypes)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    zonesApi
      .list()
      .then(setZones)
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof PartnerRegistrationPayload>(key: K, value: PartnerRegistrationPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const role = form.role;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.register(form);
      toast('Application submitted. We will review your profile shortly.');
      navigate('/login');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Registration failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            {role === 'driver' ? <CarTaxiFront className="h-7 w-7" /> : <Bike className="h-7 w-7" />}
          </div>
          <h1 className="text-2xl font-black text-neutral-900">Become a partner</h1>
          <p className="mt-1 text-sm text-neutral-500">Apply as a driver or delivery partner — review takes under 24h.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {(['delivery_partner', 'driver'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('role', r)}
              className={cn(
                'rounded-xl border bg-white p-3 text-left transition-all',
                role === r ? 'border-brand-500 ring-2 ring-brand-100' : 'border-ink-100 hover:border-ink-200'
              )}
            >
              <div className="flex items-center gap-2">
                {r === 'driver' ? (
                  <CarTaxiFront className="h-5 w-5 text-brand-600" />
                ) : (
                  <Bike className="h-5 w-5 text-brand-600" />
                )}
                <span className="text-sm font-semibold text-neutral-900">{r === 'driver' ? 'Rides & trips' : 'Food & grocery'}</span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">{r === 'driver' ? 'Drive customers in your car' : 'Deliver orders with a bike or scooter'}</p>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <section>
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Account</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="As per Aadhaar / licence" required />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" required />
              </Field>
              <Field label="Phone" required>
                <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile number" required />
              </Field>
              <Field label="Password" required className="sm:col-span-2">
                <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Minimum 8 characters" minLength={8} required />
              </Field>
            </div>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Vehicle details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {role === 'driver' ? (
                <Field label="Vehicle type" required>
                  <Select value={form.vehicle_type_id ?? ''} onChange={(e) => set('vehicle_type_id', e.target.value ? Number(e.target.value) : undefined)} required>
                    <option value="">Select…</option>
                    {vehicleTypes.map((vt) => (
                      <option key={vt.id} value={vt.id}>
                        {vt.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Vehicle type" required>
                  <Select value={form.vehicle_type ?? ''} onChange={(e) => set('vehicle_type', e.target.value)} required>
                    <option value="">Select…</option>
                    <option value="bike">Bike</option>
                    <option value="scooter">Scooter</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="car">Car</option>
                  </Select>
                </Field>
              )}
              <Field label="Vehicle number" required>
                <Input value={form.vehicle_number ?? ''} onChange={(e) => set('vehicle_number', e.target.value)} placeholder="KA-01-AB-1234" required />
              </Field>
              <Field label="Vehicle model" hint="e.g. Maruti Swift">
                <Input value={form.vehicle_model ?? ''} onChange={(e) => set('vehicle_model', e.target.value)} />
              </Field>
              <Field label="Vehicle colour">
                <Input value={form.vehicle_color ?? ''} onChange={(e) => set('vehicle_color', e.target.value)} />
              </Field>
            </div>
          </section>

          {role === 'delivery_partner' && (
            <>
            <section className="border-t border-ink-100 pt-6">
              <h2 className="mb-3 text-sm font-bold text-neutral-900">What will you deliver?</h2>
              <p className="mb-3 text-xs text-neutral-400">Choose one — you'll receive dispatch offers for that service only.</p>
              <div className="grid grid-cols-2 gap-3">
                {(['food', 'grocery'] as DeliveryServiceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('service_type', t)}
                    className={cn(
                      'rounded-xl border bg-white p-3 text-left transition-all',
                      (form.service_type ?? 'food') === t
                        ? 'border-brand-500 ring-2 ring-brand-100'
                        : 'border-ink-100 hover:border-ink-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {t === 'food' ? (
                        <UtensilsCrossed className="h-5 w-5 text-brand-600" />
                      ) : (
                        <ShoppingBasket className="h-5 w-5 text-brand-600" />
                      )}
                      <span className="text-sm font-semibold text-neutral-900">
                        {t === 'food' ? 'Food orders' : 'Grocery orders'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {t === 'food' ? 'Deliver meals from restaurants' : 'Deliver groceries & staples'}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="border-t border-ink-100 pt-6">
              <h2 className="mb-3 text-sm font-bold text-neutral-900">Service zone</h2>
              <p className="mb-3 text-xs text-neutral-400">Choose the zone you'll be delivering in — your dispatches stay within it.</p>
              <Field label="Zone" hint="Required for delivery partners">
                <Select value={form.zone_id ?? ''} onChange={(e) => set('zone_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select a zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                      {z.code ? ` (${z.code})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </section>
            </>
          )}

          <section className="border-t border-ink-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Licence & KYC</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Driving licence number" required>
                <Input value={form.license_number ?? ''} onChange={(e) => set('license_number', e.target.value)} required />
              </Field>
              <Field label="Licence expiry" required>
                <Input type="date" value={form.license_expiry ?? ''} onChange={(e) => set('license_expiry', e.target.value)} required />
              </Field>
              <Field label="Aadhaar number" required>
                <Input value={form.aadhar_number ?? ''} onChange={(e) => set('aadhar_number', e.target.value)} placeholder="12-digit Aadhaar" required />
              </Field>
              {role === 'driver' && (
                <Field label="PAN number">
                  <Input value={form.pan_number ?? ''} onChange={(e) => set('pan_number', e.target.value)} />
                </Field>
              )}
            </div>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Payout bank details</h2>
            <p className="mb-3 text-xs text-neutral-400">Optional at signup — you can add these later from Profile &amp; KYC.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account holder name">
                <Input value={form.bank_account_name ?? ''} onChange={(e) => set('bank_account_name', e.target.value)} />
              </Field>
              <Field label="Bank name">
                <Input value={form.bank_name ?? ''} onChange={(e) => set('bank_name', e.target.value)} />
              </Field>
              <Field label="Account number">
                <Input value={form.bank_account_number ?? ''} onChange={(e) => set('bank_account_number', e.target.value)} />
              </Field>
              <Field label="IFSC">
                <Input value={form.bank_ifsc ?? ''} onChange={(e) => set('bank_ifsc', e.target.value)} placeholder="HDFC0000123" />
              </Field>
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit application'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="h-4 w-4" /> Already registered? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}