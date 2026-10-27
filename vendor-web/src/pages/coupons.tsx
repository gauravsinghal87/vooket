import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { couponsApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { VendorCoupon } from '@/typings/models';

type CouponForm = {
  code: string;
  name: string;
  description: string;
  type: 'percent' | 'fixed';
  value: string;
  max_discount: string;
  min_order_amount: string;
  usage_limit: string;
  per_user_limit: string;
  starts_at: string;
  expires_at: string;
  first_order_only: boolean;
};

const emptyForm: CouponForm = {
  code: '',
  name: '',
  description: '',
  type: 'percent',
  value: '',
  max_discount: '',
  min_order_amount: '',
  usage_limit: '',
  per_user_limit: '',
  starts_at: '',
  expires_at: '',
  first_order_only: false,
};

function CouponModal({ coupon, onClose }: { coupon: VendorCoupon | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CouponForm>(
    coupon
      ? {
          code: coupon.code,
          name: coupon.name,
          description: coupon.description ?? '',
          type: coupon.type,
          value: coupon.value,
          max_discount: coupon.max_discount ?? '',
          min_order_amount: coupon.min_order_amount ?? '',
          usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : '',
          per_user_limit: coupon.per_user_limit ? String(coupon.per_user_limit) : '',
          starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 10) : '',
          expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
          first_order_only: !!coupon.first_order_only,
        }
      : { ...emptyForm }
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        value: form.value,
        max_discount: form.max_discount ? Number(form.max_discount) : undefined,
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : undefined,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
        per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : undefined,
        starts_at: form.starts_at ? `${form.starts_at}T00:00:00` : undefined,
        expires_at: form.expires_at ? `${form.expires_at}T23:59:59` : undefined,
        first_order_only: form.first_order_only,
      };
      if (coupon) {
        await couponsApi.update(coupon.id, { name: form.name, value: form.value, expires_at: body.expires_at });
      } else {
        await couponsApi.create(body);
      }
    },
    onSuccess: () => {
      toast(coupon ? 'Coupon updated' : 'Coupon created');
      void qc.invalidateQueries({ queryKey: ['vendor-coupons'] });
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{coupon ? 'Edit coupon' : 'New coupon'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" required>
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              disabled={!!coupon}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Welcome offer" />
          </Field>
          <Field label="Type" required>
            <Select value={form.type} onChange={(e) => set('type', e.target.value as 'percent' | 'fixed')}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </Select>
          </Field>
          <Field label={form.type === 'percent' ? 'Value (%)' : 'Value (₹)'} required>
            <Input type="number" min={0} step="0.01" value={form.value} onChange={(e) => set('value', e.target.value)} />
          </Field>
          {form.type === 'percent' && (
            <Field label="Max discount (₹)">
              <Input type="number" min={0} step="0.01" value={form.max_discount} onChange={(e) => set('max_discount', e.target.value)} />
            </Field>
          )}
          <Field label="Min order (₹)">
            <Input type="number" min={0} step="0.01" value={form.min_order_amount} onChange={(e) => set('min_order_amount', e.target.value)} />
          </Field>
          <Field label="Usage limit">
            <Input type="number" min={1} value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} />
          </Field>
          <Field label="Per-user limit">
            <Input type="number" min={1} value={form.per_user_limit} onChange={(e) => set('per_user_limit', e.target.value)} />
          </Field>
          <Field label="Starts on">
            <Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
          </Field>
          <Field label="Expires on">
            <Input type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
          </Field>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-ink-100 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.first_order_only}
            onChange={(e) => set('first_order_only', e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          <span className="font-medium text-neutral-800">First order only</span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.code || !form.name || form.value === '' || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CouponsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; coupon: VendorCoupon | null }>({ open: false, coupon: null });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-coupons'],
    queryFn: () => couponsApi.list({ per_page: 100 }),
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => couponsApi.update(id, { is_active }),
    onSuccess: (_d, vars) => {
      toast(vars.is_active ? 'Coupon activated' : 'Coupon paused');
      void qc.invalidateQueries({ queryKey: ['vendor-coupons'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => couponsApi.remove(id),
    onSuccess: () => {
      toast('Coupon deleted');
      void qc.invalidateQueries({ queryKey: ['vendor-coupons'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Create offers for your customers"
        actions={
          <Button size="sm" onClick={() => setModal({ open: true, coupon: null })}>
            <Plus className="h-4 w-4" /> New coupon
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
                <THeadCell>Code</THeadCell>
                <THeadCell>Discount</THeadCell>
                <THeadCell>Min order</THeadCell>
                <THeadCell>Expires</THeadCell>
                <THeadCell>Uses</THeadCell>
                <THeadCell>Status</THeadCell>
                <THeadCell className="text-right">Actions</THeadCell>
              </THeadRow>
            </THead>
            <TBody>
              {data.data.map((c) => (
                <TRow key={c.id}>
                  <TCell>
                    <span className="rounded-md bg-ink-50 px-2 py-1 font-mono text-sm font-semibold text-neutral-800">{c.code}</span>
                    <p className="mt-1 text-xs text-neutral-400">{c.name}</p>
                  </TCell>
                  <TCell className="font-medium">
                    {c.type === 'percent' ? `${Number(c.value)}%` : formatCurrency(c.value)}
                    {c.max_discount && Number(c.max_discount) > 0 && (
                      <span className="text-xs text-neutral-400"> · cap {formatCurrency(c.max_discount)}</span>
                    )}
                  </TCell>
                  <TCell className="text-sm">{c.min_order_amount ? formatCurrency(c.min_order_amount) : '—'}</TCell>
                  <TCell className="text-sm">{c.expires_at ? formatDate(c.expires_at) : 'Never'}</TCell>
                  <TCell>{c.coupon_usages_count ?? 0}</TCell>
                  <TCell>
                    <StatusBadge status={(c.status ?? (c.is_active ? 'active' : 'paused')).toLowerCase()} />
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant={c.is_active ? 'outline' : 'success'}
                        disabled={pauseMutation.isPending}
                        onClick={() => pauseMutation.mutate({ id: c.id, is_active: !c.is_active })}
                      >
                        {c.is_active ? 'Pause' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, coupon: c })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(c.id)}>
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

      {modal.open && <CouponModal coupon={modal.coupon} onClose={() => setModal({ open: false, coupon: null })} />}
    </>
  );
}