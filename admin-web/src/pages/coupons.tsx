import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Pencil } from 'lucide-react';
import { couponsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { AdminCoupon } from '@/typings/models';

type CouponDraft = {
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed' | 'shipping';
  value: string;
  max_discount: string;
  min_order_amount: string;
  service: string;
  usage_limit: string;
  per_user_limit: string;
  starts_at: string;
  expires_at: string;
  first_order_only: boolean;
  is_active: boolean;
};

const emptyDraft: CouponDraft = {
  code: '',
  name: '',
  description: '',
  type: 'percentage',
  value: '',
  max_discount: '',
  min_order_amount: '',
  service: 'all',
  usage_limit: '',
  per_user_limit: '',
  starts_at: '',
  expires_at: '',
  first_order_only: false,
  is_active: true,
};

const toLocalInput = (iso?: string | null): string => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

function draftFromCoupon(c: AdminCoupon): CouponDraft {
  return {
    code: c.code ?? '',
    name: c.name ?? '',
    description: c.description ?? '',
    type: c.type ?? 'percentage',
    value: c.value ?? '',
    max_discount: c.max_discount ?? '',
    min_order_amount: c.min_order_amount ?? '',
    service: c.service ?? 'all',
    usage_limit: c.usage_limit ? String(c.usage_limit) : '',
    per_user_limit: c.per_user_limit ? String(c.per_user_limit) : '',
    starts_at: toLocalInput(c.starts_at),
    expires_at: toLocalInput(c.expires_at),
    first_order_only: Boolean(c.first_order_only),
    is_active: Boolean(c.is_active),
  };
}

function CouponFormModal({
  editing,
  open,
  onOpenChange,
}: {
  editing: AdminCoupon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<CouponDraft>(() => (editing ? draftFromCoupon(editing) : emptyDraft));

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) return couponsApi.update(editing.id, body);
      return couponsApi.create(body);
    },
    onSuccess: () => {
      toast(editing ? 'Coupon updated' : 'Coupon created');
      void qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      onOpenChange(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const set = <K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    const body: Record<string, unknown> = { is_active: draft.is_active };

    if (editing) {
      body.code = draft.code.trim().toUpperCase();
      body.name = draft.name.trim();
      body.value = draft.value;
      if (draft.expires_at) body.expires_at = draft.expires_at;
    } else {
      body.code = draft.code.trim().toUpperCase();
      body.name = draft.name.trim();
      body.description = draft.description.trim() || undefined;
      body.type = draft.type;
      body.value = draft.value;
      if (draft.max_discount) body.max_discount = draft.max_discount;
      if (draft.min_order_amount) body.min_order_amount = draft.min_order_amount;
      if (draft.service !== 'all') body.service = draft.service;
      if (draft.usage_limit) body.usage_limit = Number(draft.usage_limit);
      if (draft.per_user_limit) body.per_user_limit = Number(draft.per_user_limit);
      if (draft.starts_at) body.starts_at = draft.starts_at;
      if (draft.expires_at) body.expires_at = draft.expires_at;
      body.first_order_only = draft.first_order_only;
    }

    saveMutation.mutate(body);
  };

  const canSave =
    draft.code.trim().length > 0 &&
    draft.name.trim().length > 0 &&
    draft.value !== '' &&
    Number(draft.value) >= 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit coupon · ${editing.code}` : 'New coupon'}
      description={editing ? 'Only code, name, value, expiry and status can be changed.' : 'Create a discount coupon'}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Code</label>
            <Input
              placeholder="SUMMER25"
              value={draft.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
            <p className="mt-1 text-[10px] text-neutral-400">Letters, numbers and underscores only.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Name</label>
            <Input
              placeholder="Summer Sale"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">Description</label>
          <Textarea
            rows={2}
            placeholder="Optional description shown to customers"
            value={draft.description}
            disabled={!!editing}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Type</label>
            <Select value={draft.type} disabled={!!editing} onChange={(e) => set('type', e.target.value as CouponDraft['type'])}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
              <option value="shipping">Shipping</option>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Value</label>
            <Input
              type="number"
              min="0"
              value={draft.value}
              onChange={(e) => set('value', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Max discount</label>
            <Input
              type="number"
              min="0"
              placeholder="Optional"
              disabled={!!editing}
              value={draft.max_discount}
              onChange={(e) => set('max_discount', e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Min order amount</label>
            <Input
              type="number"
              min="0"
              placeholder="Optional"
              disabled={!!editing}
              value={draft.min_order_amount}
              onChange={(e) => set('min_order_amount', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Service</label>
            <Select value={draft.service} disabled={!!editing} onChange={(e) => set('service', e.target.value)}>
              <option value="all">All services</option>
              <option value="food">Food</option>
              <option value="grocery">Grocery</option>
              <option value="rides">Rides</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Usage limit</label>
            <Input
              type="number"
              min="1"
              placeholder="Unlimited"
              disabled={!!editing}
              value={draft.usage_limit}
              onChange={(e) => set('usage_limit', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Per-user limit</label>
            <Input
              type="number"
              min="1"
              placeholder="Unlimited"
              disabled={!!editing}
              value={draft.per_user_limit}
              onChange={(e) => set('per_user_limit', e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Starts at</label>
            <Input
              type="datetime-local"
              disabled={!!editing}
              value={draft.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Expires at</label>
            <Input
              type="datetime-local"
              value={draft.expires_at}
              onChange={(e) => set('expires_at', e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3',
              draft.first_order_only ? 'border-brand-500 bg-brand-50' : 'border-ink-100',
              editing && 'pointer-events-none opacity-50'
            )}
          >
            <span>
              <span className="block text-sm font-medium text-neutral-800">First order only</span>
              <span className="block text-xs text-neutral-400">Valid only on the customer's first order.</span>
            </span>
            <input
              type="checkbox"
              checked={draft.first_order_only}
              onChange={(e) => set('first_order_only', e.target.checked)}
            />
          </label>
          <label
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3',
              draft.is_active ? 'border-brand-500 bg-brand-50' : 'border-ink-100'
            )}
          >
            <span>
              <span className="block text-sm font-medium text-neutral-800">Active</span>
              <span className="block text-xs text-neutral-400">Customers can claim this coupon.</span>
            </span>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave || saveMutation.isPending} onClick={submit}>
            {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CouponsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-coupons', page, search],
    queryFn: () => couponsApi.list({ page, search: search || null }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => couponsApi.setActive(id, is_active),
    onSuccess: (_d, vars) => {
      toast(vars.is_active ? 'Coupon activated' : 'Coupon deactivated');
      void qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => couponsApi.remove(id),
    onSuccess: () => {
      toast('Coupon deleted');
      void qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (c: AdminCoupon) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Promotions and discounts"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New coupon
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search coupon code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(query.trim());
                setPage(1);
              }
            }}
            className="w-64 pl-9"
          />
        </div>
      </div>

      <Card className="px-0 py-0">
        {isLoading ? (
          <Skeleton className="p-6" />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <Table>
              <THead>
                <THeadRow>
                  <THeadCell>Code</THeadCell>
                  <THeadCell>Service</THeadCell>
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
                      <div>
                        <span className="rounded-md bg-ink-50 px-2 py-1 font-mono text-sm font-semibold text-neutral-800">{c.code}</span>
                        <p className="mt-1 text-xs text-neutral-400">{c.name}</p>
                      </div>
                    </TCell>
                    <TCell className="text-sm capitalize">{c.service === 'all' ? 'All' : c.service ?? 'All'}</TCell>
                    <TCell className="font-medium">
                      {c.type === 'percentage' ? `${Number(c.value)}%` : formatCurrency(c.value)}
                      {c.max_discount && Number(c.max_discount) > 0 && <span className="text-xs text-neutral-400"> · cap {formatCurrency(c.max_discount)}</span>}
                    </TCell>
                    <TCell className="text-sm">{c.min_order_amount ? formatCurrency(c.min_order_amount) : '—'}</TCell>
                    <TCell className="text-sm">{c.expires_at ? formatDate(c.expires_at) : 'Never'}</TCell>
                    <TCell>{c.coupon_usages_count ?? c.total_uses ?? 0}</TCell>
                    <TCell>
                      <StatusBadge status={(c.status ?? (c.is_active ? 'active' : 'paused')).toLowerCase()} />
                    </TCell>
                    <TCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={c.is_active ? 'outline' : 'success'}
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate({ id: c.id, is_active: !c.is_active })}
                        >
                          {c.is_active ? 'Pause' : 'Enable'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
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
            <Pagination page={data.current_page} lastPage={data.last_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <CouponFormModal
        key={editing?.id ?? 'new-coupon'}
        editing={editing}
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      />
    </>
  );
}