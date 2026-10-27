import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ShoppingBasket, ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { vendorAuthApi, type VendorRegistrationPayload } from '@/repositories/vendor';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type VendorType = 'restaurant' | 'grocery';

const EMPTY: VendorRegistrationPayload = {
  vendor_type: 'grocery',
  business_name: '',
  owner_name: '',
  email: '',
  phone: '',
  password: '',
  country_code: '+91',
  address: '',
  gst_number: '',
  pan_number: '',
  fssai_number: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  bank_name: '',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<VendorRegistrationPayload>(EMPTY);
  const [busy, setBusy] = useState(false);

  // Food restaurants only — kept separate from `form` so they are never sent
  // for grocery registrations.
  const [prepTime, setPrepTime] = useState('20');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof VendorRegistrationPayload>(key: K, value: VendorRegistrationPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const vendorType = form.vendor_type;

  const validateRestaurantDetails = (): Record<string, string> => {
    if (vendorType !== 'restaurant') return {};

    const next: Record<string, string> = {};
    const minutes = Number(prepTime);

    if (!prepTime.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      next.avg_prep_time_min = 'Enter a whole number of minutes between 1 and 180.';
    }
    if (!opensAt) {
      next.opens_at = 'Opening time is required.';
    }
    if (!closesAt) {
      next.closes_at = 'Closing time is required.';
    } else if (opensAt && opensAt === closesAt) {
      next.closes_at = 'Closing time must be different from opening time.';
    }

    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const found = validateRestaurantDetails();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast('Please fix the restaurant details', 'error');
      return;
    }

    setBusy(true);
    try {
      const payload: VendorRegistrationPayload =
        vendorType === 'restaurant'
          ? { ...form, avg_prep_time_min: Number(prepTime), opens_at: opensAt, closes_at: closesAt }
          : form;

      await vendorAuthApi.register(payload);
      toast('Application submitted. We will review your business shortly.');
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
            {vendorType === 'restaurant' ? <UtensilsCrossed className="h-7 w-7" /> : <ShoppingBasket className="h-7 w-7" />}
          </div>
          <h1 className="text-2xl font-black text-neutral-900">List your business with us</h1>
          <p className="mt-1 text-sm text-neutral-500">Apply as a food restaurant or grocery store — review takes under 24h.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {(['grocery', 'restaurant'] as VendorType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                set('vendor_type', t);
                setErrors({});
              }}
              className={cn(
                'rounded-xl border bg-white p-3 text-left transition-all',
                vendorType === t ? 'border-brand-500 ring-2 ring-brand-100' : 'border-ink-100 hover:border-ink-200'
              )}
            >
              <div className="flex items-center gap-2">
                {t === 'grocery' ? (
                  <ShoppingBasket className="h-5 w-5 text-brand-600" />
                ) : (
                  <UtensilsCrossed className="h-5 w-5 text-brand-600" />
                )}
                <span className="text-sm font-semibold text-neutral-900">{t === 'grocery' ? 'Grocery store' : 'Food restaurant'}</span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                {t === 'grocery' ? 'Fresh produce, packaged goods & staples' : 'Your kitchen, menu and home delivery'}
              </p>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <section>
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Business details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" required className="sm:col-span-2">
                <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="e.g. Spice Villa / FreshMart" required />
              </Field>
              <Field label="Owner / contact person" required>
                <Input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="As per PAN / Aadhaar" required />
              </Field>
              <Field label="Business address" hint="Pickup / store address" className="sm:col-span-2">
                <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="Street, area, city" />
              </Field>
            </div>
          </section>

          {vendorType === 'restaurant' && (
            <section className="border-t border-ink-100 pt-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Clock className="h-4 w-4 text-brand-600" /> Restaurant details
              </h2>
              <p className="mb-3 text-xs text-neutral-400">
                Used to estimate delivery times and show customers when your kitchen is open.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Average Food Preparation Time"
                  required
                  hint="How long your kitchen typically takes to prepare an order before it is ready for pickup."
                  className="sm:col-span-2"
                >
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    step={1}
                    inputMode="numeric"
                    value={prepTime}
                    onChange={(e) => {
                      setPrepTime(e.target.value);
                      setErrors((prev) => ({ ...prev, avg_prep_time_min: '' }));
                    }}
                    onBlur={() => setErrors((prev) => ({ ...prev, ...validateRestaurantDetails() }))}
                    placeholder="20"
                    required
                  />
                  {errors.avg_prep_time_min && (
                    <span className="mt-1.5 block text-xs font-medium text-red-500">{errors.avg_prep_time_min}</span>
                  )}
                </Field>

                <Field label="Restaurant Opening Time" required>
                  <Input
                    type="time"
                    value={opensAt}
                    onChange={(e) => {
                      setOpensAt(e.target.value);
                      setErrors((prev) => ({ ...prev, opens_at: '', closes_at: '' }));
                    }}
                    required
                  />
                  {errors.opens_at && (
                    <span className="mt-1.5 block text-xs font-medium text-red-500">{errors.opens_at}</span>
                  )}
                </Field>

                <Field label="Restaurant Closing Time" required>
                  <Input
                    type="time"
                    value={closesAt}
                    onChange={(e) => {
                      setClosesAt(e.target.value);
                      setErrors((prev) => ({ ...prev, closes_at: '' }));
                    }}
                    required
                  />
                  {errors.closes_at && (
                    <span className="mt-1.5 block text-xs font-medium text-red-500">{errors.closes_at}</span>
                  )}
                </Field>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Times use a 24-hour clock. For overnight service, set a closing time earlier than the opening time — for
                example 18:00 to 02:00 means open through the night until 2 AM.
              </p>
            </section>
          )}

          <section className="border-t border-ink-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Account</h2>
            <div className="grid gap-4 sm:grid-cols-2">
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
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Registration & KYC</h2>
            <p className="mb-3 text-xs text-neutral-400">
              {vendorType === 'restaurant' ? 'FSSAI number is required for food businesses.' : 'GST and PAN help us process payouts faster — add them if available.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST number">
                <Input value={form.gst_number ?? ''} onChange={(e) => set('gst_number', e.target.value)} placeholder="22ABCDE1234F1Z5" />
              </Field>
              <Field label="PAN number">
                <Input value={form.pan_number ?? ''} onChange={(e) => set('pan_number', e.target.value)} placeholder="ABCDE1234F" />
              </Field>
              {vendorType === 'restaurant' && (
                <Field label="FSSAI number" required>
                  <Input value={form.fssai_number ?? ''} onChange={(e) => set('fssai_number', e.target.value)} placeholder="14-digit FSSAI licence" required />
                </Field>
              )}
            </div>
          </section>

          <section className="border-t border-ink-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-neutral-900">Payout bank details</h2>
            <p className="mb-3 text-xs text-neutral-400">Optional at signup — you can add these later from Profile.</p>
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