import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, X, Package, ImagePlus, Settings2 } from 'lucide-react';
import { productsApi } from '@/repositories/vendor';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input, Select, Field, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import type { VendorProduct, ProductType, SelectionType } from '@/typings/models';

type OptionDraft = { id?: number; name: string; price: string; is_default: boolean; is_available: boolean };

type OptionGroupDraft = {
  id?: number;
  name: string;
  selection_type: SelectionType;
  is_required: boolean;
  is_active: boolean;
  min_select: number;
  max_select: number;
  options: OptionDraft[];
};

type ProductForm = {
  name: string;
  category_id: string;
  price: string;
  compare_at_price: string;
  description: string;
  image: string;
  is_veg: boolean;
  is_featured: boolean;
  is_available: boolean;
  unit_type: string;
  unit_value: string;
  unit_label: string;
  min_order_qty: string;
  max_order_qty: string;
  preparation_time_min: string;
  track_inventory: boolean;
  quantity: string;
  low_stock_threshold: string;
  product_type: ProductType;
  option_groups: OptionGroupDraft[];
};

const newOption = (): OptionDraft => ({ name: '', price: '0', is_default: false, is_available: true });

const newOptionGroup = (): OptionGroupDraft => ({
  name: '',
  selection_type: 'SINGLE',
  is_required: true,
  is_active: true,
  min_select: 1,
  max_select: 1,
  options: [newOption(), newOption()],
});

function toGroupDraft(group: NonNullable<VendorProduct['variation_options']>[number]): OptionGroupDraft {
  const selectionType = (group.selection_type ?? '').toUpperCase();
  const isMulti =
    group.is_multi_select === true || group.type === 'checkbox' || selectionType === 'MULTIPLE';

  return {
    id: group.id,
    name: group.name,
    selection_type: isMulti ? 'MULTIPLE' : 'SINGLE',
    is_required: !!group.is_required,
    is_active: group.is_active !== false,
    min_select: group.min_select ?? (group.is_required ? 1 : 0),
    max_select: isMulti && group.max_select ? group.max_select : isMulti ? 5 : 1,
    options: (group.values ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      price: String(v.price_adjustment ?? v.price ?? 0),
      is_default: !!v.is_default,
      is_available: v.is_available !== false && v.is_active !== false,
    })),
  };
}

function buildOptionGroupsPayload(groups: OptionGroupDraft[]) {
  return groups
    .filter((g) => g.name.trim())
    .map((g) => ({
      id: g.id,
      name: g.name.trim(),
      selection_type: g.selection_type,
      is_required: g.selection_type === 'SINGLE' ? g.is_required : false,
      is_active: g.is_active,
      min_select: g.selection_type === 'SINGLE' ? (g.is_required ? 1 : 0) : g.min_select,
      max_select: g.selection_type === 'SINGLE' ? 1 : Math.max(g.max_select, g.min_select, 1),
      options: g.options
        .filter((o) => o.name.trim())
        .map((o) => ({
          id: o.id,
          name: o.name.trim(),
          price: Number(o.price) || 0,
          is_default: o.is_default,
          is_active: o.is_available,
          is_available: o.is_available,
        })),
    }));
}

const emptyForm: ProductForm = {
  name: '',
  category_id: '',
  price: '',
  compare_at_price: '',
  description: '',
  image: '',
  is_veg: false,
  is_featured: false,
  is_available: true,
  unit_type: '',
  unit_value: '',
  unit_label: '',
  min_order_qty: '1',
  max_order_qty: '',
  preparation_time_min: '',
  track_inventory: false,
  quantity: '0',
  low_stock_threshold: '10',
  product_type: 'simple',
  option_groups: [],
};

function toForm(p: VendorProduct): ProductForm {
  return {
    name: p.name,
    category_id: p.category_id ? String(p.category_id) : '',
    price: p.price ?? '',
    compare_at_price: p.compare_at_price ?? '',
    description: p.description ?? '',
    image: p.image ?? '',
    is_veg: !!p.is_veg,
    is_featured: !!p.is_featured,
    is_available: !!p.is_available,
    unit_type: p.unit_type ?? '',
    unit_value: p.unit_value ?? '',
    unit_label: p.unit_label ?? '',
    min_order_qty: p.min_order_qty ? String(p.min_order_qty) : '1',
    max_order_qty: p.max_order_qty ? String(p.max_order_qty) : '',
    preparation_time_min: p.preparation_time_min ? String(p.preparation_time_min) : '',
    track_inventory: !!p.inventory?.track_inventory,
    quantity: p.inventory?.quantity != null ? String(p.inventory.quantity) : '0',
    low_stock_threshold: p.inventory?.low_stock_threshold != null ? String(p.inventory.low_stock_threshold) : '10',
    product_type: p.product_type ?? (p.variation_options?.length ? 'variable' : 'simple'),
    option_groups: (p.variation_options ?? []).map(toGroupDraft),
  };
}

function OptionGroupsSection({
  groups,
  onChange,
}: {
  groups: OptionGroupDraft[];
  onChange: (groups: OptionGroupDraft[]) => void;
}) {
  const updateGroup = (index: number, patch: Partial<OptionGroupDraft>) => {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const updateOption = (gIndex: number, oIndex: number, patch: Partial<OptionDraft>) => {
    onChange(
      groups.map((g, i) =>
        i === gIndex ? { ...g, options: g.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o)) } : g
      )
    );
  };

  return (
    <div className="space-y-3">
      {groups.map((group, gIndex) => {
        const isMulti = group.selection_type === 'MULTIPLE';

        return (
          <div key={gIndex} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Group name e.g. Size"
                  value={group.name}
                  onChange={(e) => updateGroup(gIndex, { name: e.target.value })}
                />
                <Select
                  value={group.selection_type}
                  onChange={(e) => updateGroup(gIndex, { selection_type: e.target.value as SelectionType })}
                >
                  <option value="SINGLE">Single select (price-defining)</option>
                  <option value="MULTIPLE">Multi select (priced add-ons)</option>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => onChange(groups.filter((_, i) => i !== gIndex))}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  checked={group.is_required}
                  onChange={(e) => updateGroup(gIndex, { is_required: e.target.checked, min_select: e.target.checked ? 1 : 0 })}
                />
                <span className="font-medium text-neutral-700">Required</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  checked={group.is_active}
                  onChange={(e) => updateGroup(gIndex, { is_active: e.target.checked })}
                />
                <span className="font-medium text-neutral-700">Active</span>
              </label>
              {isMulti && (
                <>
                  <label className="flex items-center gap-1.5 text-neutral-500">
                    Min
                    <Input
                      type="number"
                      min={0}
                      className="w-16"
                      value={group.min_select}
                      onChange={(e) => updateGroup(gIndex, { min_select: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-neutral-500">
                    Max
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      value={group.max_select}
                      onChange={(e) => updateGroup(gIndex, { max_select: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="space-y-2">
              {group.options.map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <Input
                    placeholder="Option name e.g. Large"
                    value={option.name}
                    onChange={(e) => updateOption(gIndex, oIndex, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="₹0"
                    className="w-24"
                    value={option.price}
                    onChange={(e) => updateOption(gIndex, oIndex, { price: e.target.value })}
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500" title="Preselect this option for customers">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                      checked={option.is_default}
                      onChange={(e) =>
                        updateGroup(gIndex, {
                          options: group.options.map((o, j) => ({ ...o, is_default: j === oIndex ? e.target.checked : false })),
                        })
                      }
                    />
                    Default
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500" title="Keep option buyable">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                      checked={option.is_available}
                      onChange={(e) => updateOption(gIndex, oIndex, { is_available: e.target.checked })}
                    />
                    Available
                  </label>
                  <button
                    type="button"
                    onClick={() => updateGroup(gIndex, { options: group.options.filter((_, i) => i !== oIndex) })}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => updateGroup(gIndex, { options: [...group.options, newOption()] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add option
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...groups, newOptionGroup()])}
      >
        <Plus className="h-4 w-4" /> Add option group
      </Button>

      <p className="text-xs leading-relaxed text-neutral-400">
        Single-select groups define the product price (e.g. Size) — a priced choice replaces the base price.
        Multi-select groups are priced add-ons added on top (e.g Extra Cheese). Option prices are validated on our server.
      </p>
    </div>
  );
}

function ProductLoadingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl items-center justify-center rounded-2xl bg-white p-10 shadow-card">
        <p className="text-sm text-neutral-500">Loading product…</p>
      </div>
    </div>
  );
}

function ProductModal({ product, onClose }: { product: VendorProduct | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductForm>(product ? toForm(product) : { ...emptyForm });

  const { data: categories } = useQuery({
    queryKey: ['vendor-product-categories'],
    queryFn: () => productsApi.categories(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        category_id: form.category_id,
        price: form.price,
        compare_at_price: form.compare_at_price || undefined,
        description: form.description || undefined,
        image: form.image || undefined,
        is_veg: form.is_veg,
        is_featured: form.is_featured,
        is_available: form.is_available,
        unit_type: form.unit_type || undefined,
        unit_value: form.unit_value ? Number(form.unit_value) : undefined,
        unit_label: form.unit_label || undefined,
        min_order_qty: form.min_order_qty ? Number(form.min_order_qty) : undefined,
        max_order_qty: form.max_order_qty ? Number(form.max_order_qty) : undefined,
        preparation_time_min: form.preparation_time_min ? Number(form.preparation_time_min) : undefined,
        track_inventory: form.track_inventory,
        quantity: form.track_inventory ? Number(form.quantity) : undefined,
        low_stock_threshold: form.track_inventory ? Number(form.low_stock_threshold) : undefined,
        product_type: form.product_type,
        option_groups: form.product_type === 'variable' ? buildOptionGroupsPayload(form.option_groups) : undefined,
      };
      if (product) {
        await productsApi.update(product.id, body);
      } else {
        await productsApi.create(body);
      }
    },
    onSuccess: () => {
      toast(product ? 'Product updated' : 'Product created');
      void qc.invalidateQueries({ queryKey: ['vendor-products'] });
      if (product) {
        void qc.invalidateQueries({ queryKey: ['vendor-product', product.id] });
      }
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const { image } = await productsApi.uploadImage(file);
      set('image', image);
      toast('Image uploaded');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeImageMutation = useMutation({
    mutationFn: async () => {
      if (product && form.image === product.image) {
        await productsApi.removeImage(product.id);
      }
    },
    onSuccess: () => {
      set('image', '');
      toast('Image removed');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Remove failed', 'error'),
  });

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{product ? `Edit · ${product.name}` : 'Add product'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chicken Biryani / Milk 1L" />
          </Field>
          <Field label="Category" required>
            <Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Select category…</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price (₹)" required>
            <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          <Field label="Compare-at price (₹)">
            <Input type="number" min={0} step="0.01" value={form.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} />
          </Field>
          <Field label="Unit type">
            <Select value={form.unit_type} onChange={(e) => set('unit_type', e.target.value)}>
              <option value="">None</option>
              <option value="gms">Grams (g)</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="ltr">Litres (l)</option>
              <option value="pcs">Pieces</option>
              <option value="packet">Packet</option>
              <option value="serving">Serving</option>
            </Select>
          </Field>
          <Field label="Unit label">
            <Input value={form.unit_label} onChange={(e) => set('unit_label', e.target.value)} placeholder="e.g. per plate" />
          </Field>
          <Field label="Min order qty">
            <Input type="number" min={1} value={form.min_order_qty} onChange={(e) => set('min_order_qty', e.target.value)} />
          </Field>
          <Field label="Max order qty">
            <Input type="number" min={1} value={form.max_order_qty} onChange={(e) => set('max_order_qty', e.target.value)} />
          </Field>
          <Field label="Prep time (min)">
            <Input type="number" min={1} value={form.preparation_time_min} onChange={(e) => set('preparation_time_min', e.target.value)} />
          </Field>
          <Field label="Product image" className="sm:col-span-2">
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.image ? (
                  <img src={form.image} alt="Product preview" className="h-20 w-20 rounded-xl border border-ink-100 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50 text-neutral-400">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
                {form.image && (
                  <button
                    type="button"
                    title="Remove image"
                    disabled={removeImageMutation.isPending}
                    onClick={() => removeImageMutation.mutate()}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? 'Uploading…' : form.image ? 'Replace image' : 'Upload image'}
                </Button>
                {product && form.image === product.image && (
                  <p className="text-xs text-neutral-400">Removing deletes the file from the server.</p>
                )}
              </div>
            </div>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-100 px-3 py-2.5 text-sm">
            <input type="checkbox" checked={form.is_veg} onChange={(e) => set('is_veg', e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-600" />
            <span className="font-medium text-neutral-800">Vegetarian</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-100 px-3 py-2.5 text-sm">
            <input type="checkbox" checked={form.track_inventory} onChange={(e) => set('track_inventory', e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-600" />
            <span className="font-medium text-neutral-800">Track inventory</span>
          </label>
          {form.track_inventory && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <Field label="Quantity on hand">
                <Input type="number" min={0} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
              </Field>
              <Field label="Low stock threshold">
                <Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-ink-100 p-3">
          <Field label="Product type">
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                  form.product_type === 'simple' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100'
                }`}
              >
                <input
                  type="radio"
                  name="product_type"
                  className="h-4 w-4 text-brand-600"
                  checked={form.product_type === 'simple'}
                  onChange={() => set('product_type', 'simple')}
                />
                <span className="font-medium">Simple</span>
                <span className="text-xs text-neutral-400">Fixed price, no options</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                  form.product_type === 'variable' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100'
                }`}
              >
                <input
                  type="radio"
                  name="product_type"
                  className="h-4 w-4 text-brand-600"
                  checked={form.product_type === 'variable'}
                  onChange={() => set('product_type', 'variable')}
                />
                <span className="font-medium">Variable</span>
                <span className="text-xs text-neutral-400">Size / toppings / flavours</span>
              </label>
            </div>
          </Field>
        </div>

        {form.product_type === 'variable' && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-neutral-500" />
              <h3 className="text-sm font-semibold text-neutral-900">Option groups</h3>
              {form.option_groups.length === 0 && <span className="text-xs text-amber-600">Add at least one group</span>}
            </div>
            <OptionGroupsSection groups={form.option_groups} onChange={(groups) => set('option_groups', groups)} />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              !form.name ||
              !form.category_id ||
              form.price === '' ||
              mutation.isPending ||
              (form.product_type === 'variable' && buildOptionGroupsPayload(form.option_groups).length === 0)
            }
          >
            {mutation.isPending ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProductsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; productId: number | null }>({ open: false, productId: null });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-products', page, search, categoryId],
    queryFn: () => productsApi.list({ page, search: search || null, category_id: categoryId ? Number(categoryId) : null }),
  });

  const { data: categories } = useQuery({
    queryKey: ['vendor-product-categories'],
    queryFn: () => productsApi.categories(),
  });

  const { data: editingProduct, isLoading: loadingProduct } = useQuery({
    queryKey: ['vendor-product', modal.productId],
    queryFn: () => productsApi.get(modal.productId as number),
    enabled: modal.open && modal.productId != null,
  });

  const closeModal = () => setModal({ open: false, productId: null });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => productsApi.toggle(id),
    onSuccess: (_d, id) => {
      const was = data?.data.find((p) => p.id === id);
      toast(`${was?.name} now ${was?.is_available ? 'unavailable' : 'available'}`);
      void qc.invalidateQueries({ queryKey: ['vendor-products'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      toast('Product deleted');
      void qc.invalidateQueries({ queryKey: ['vendor-products'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your menu / catalogue"
        actions={
          <Button size="sm" onClick={() => setModal({ open: true, productId: null })}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search products…"
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
        <Select
          className="w-48"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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
                  <THeadCell>Product</THeadCell>
                  <THeadCell>Category</THeadCell>
                  <THeadCell className="text-right">Price</THeadCell>
                  <THeadCell className="text-right">Stock</THeadCell>
                  <THeadCell>Status</THeadCell>
                  <THeadCell className="text-right">Actions</THeadCell>
                </THeadRow>
              </THead>
              <TBody>
                {data.data.map((p) => (
                  <TRow key={p.id}>
                    <TCell>
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-neutral-400">
                            <Package className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                            {p.name} {p.is_veg && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle" />}
                            {p.product_type === 'variable' && (
                              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                                {p.option_groups_count} groups
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {p.unit_label ? `${p.unit_label}` : p.sku ? p.sku : `#${p.id}`}
                          </p>
                        </div>
                      </div>
                    </TCell>
                    <TCell className="text-sm">{p.category?.name ?? '—'}</TCell>
                    <TCell className="text-right">
                      <p className="font-medium">{formatCurrency(p.price)}</p>
                      {p.compare_at_price && <p className="text-xs text-neutral-400 line-through">{formatCurrency(p.compare_at_price)}</p>}
                    </TCell>
                    <TCell className="text-right text-sm">
                      {p.inventory?.track_inventory ? (
                        <span className={Number(p.inventory.quantity) <= Number(p.inventory.low_stock_threshold ?? 0) ? 'text-amber-600' : 'text-neutral-700'}>
                          {p.inventory.quantity}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TCell>
                    <TCell>
                      <StatusBadge status={p.is_available ? 'available' : 'unavailable'} />
                    </TCell>
                    <TCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={p.is_available ? 'outline' : 'success'}
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate(p.id)}
                        >
                          {p.is_available ? 'Out' : 'Live'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, productId: p.id })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(p.id)}>
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

      {modal.open &&
        (modal.productId == null ? (
          <ProductModal product={null} onClose={closeModal} />
        ) : loadingProduct || !editingProduct ? (
          <ProductLoadingModal onClose={closeModal} />
        ) : (
          <ProductModal product={editingProduct} onClose={closeModal} />
        ))}
    </>
  );
}