import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, List, Loader2, Pencil, Plus, RotateCcw, Save, Store, Trash2, Undo2, Upload, X } from 'lucide-react';
import { categoriesApi, outletsApi } from '@/repositories/vendor';
import type { PlatformCategoryView, VendorCategory } from '@/typings/models';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Field } from '@/components/ui/input';
import { Switch } from '@/components/ui/controls';
import { Table, THead, THeadRow, THeadCell, TBody, TRow, TCell } from '@/components/ui/table';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type CategoryForm = {
  name: string;
  slug: string;
  parent_id: string;
  description: string;
  image: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
  scope: string;
};

const emptyForm: CategoryForm = {
  name: '',
  slug: '',
  parent_id: '',
  description: '',
  image: '',
  icon: '',
  sort_order: '0',
  is_active: true,
  scope: '',
};

function formFromCategory(c: VendorCategory): CategoryForm {
  return {
    name: c.name,
    slug: c.slug ?? '',
    parent_id: c.parent_id != null ? String(c.parent_id) : '',
    description: c.description ?? '',
    image: c.image ?? '',
    icon: c.icon ?? '',
    sort_order: String(c.sort_order ?? 0),
    is_active: c.is_active,
    scope: c.restaurant_id ? `restaurant:${c.restaurant_id}` : c.store_id ? `store:${c.store_id}` : '',
  };
}

function CategoryModal({
  category,
  onClose,
}: {
  category: VendorCategory | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CategoryForm>(category ? formFromCategory(category) : { ...emptyForm });
  const [error, setError] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ['vendor-category-options'],
    queryFn: () => categoriesApi.options(),
  });

  const outletsQuery = useQuery({
    queryKey: ['vendor-outlets'],
    queryFn: () => outletsApi.list(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required.');
      const match = form.scope.match(/^(restaurant|store):(\d+)$/);
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        parent_id: form.parent_id ? Number(form.parent_id) : undefined,
        description: form.description.trim() || undefined,
        image: form.image.trim() || undefined,
        icon: form.icon.trim() || undefined,
        sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
        is_active: form.is_active,
        store_id: match && match[1] === 'store' ? Number(match[2]) : undefined,
        restaurant_id: match && match[1] === 'restaurant' ? Number(match[2]) : undefined,
      };
      if (category) await categoriesApi.update(category.id, body);
      else await categoriesApi.create(body);
    },
    onSuccess: () => {
      toast(category ? 'Category updated' : 'Category created');
      void qc.invalidateQueries({ queryKey: ['vendor-categories'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Save failed'),
  });

  const set = <K extends keyof CategoryForm>(k: K, v: CategoryForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const uploadMutation = useMutation({
    mutationFn: (file: File) => categoriesApi.uploadImage(file),
  });

  const scopedOptions = (optionsQuery.data ?? []).filter((o) => o.id !== category?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{category ? `Edit “${category.name}”` : 'New category'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Starters" />
          </Field>
          <Field label="Slug" hint="Optional.">
            <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="starters" />
          </Field>
          <Field label="Parent category">
            <Select value={form.parent_id} onChange={(e) => set('parent_id', e.target.value)}>
              <option value="">None (top-level)</option>
              {scopedOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Outlet scope" hint="Which outlet this category is used in.">
            <Select value={form.scope} onChange={(e) => set('scope', e.target.value)}>
              <option value="">All outlets</option>
              {(outletsQuery.data ?? []).map((o) => (
                <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>{o.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sort order">
            <Input type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </Field>
          <Field label="Icon key">
            <Input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="utensils" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <CategoryImageField
              value={form.image}
              category={category}
              uploading={uploadMutation.isPending}
              onUpload={(file) => uploadMutation.mutateAsync(file)}
              onChange={(image) => set('image', image)}
              onError={(msg) => setError(msg)}
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-ink-100 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          <span className="font-medium text-neutral-800">Active</span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ForceDeleteModal({ category, onClose }: { category: VendorCategory; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => categoriesApi.remove(category.id, true),
    onSuccess: () => {
      toast('Category deleted. Its products were kept.');
      void qc.invalidateQueries({ queryKey: ['vendor-categories'] });
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card animate-fade-in">
        <h2 className="text-lg font-bold text-neutral-900">Delete “{category.name}”?</h2>
        <p className="mt-2 text-sm text-neutral-500">
          This category has <span className="font-semibold text-neutral-800">{category.products_count}</span> product(s) attached.
          Deleting it will keep the products but remove them from this category.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Trash2 className="h-4 w-4" /> Delete anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'mine' | 'platform'>('mine');
  const [showTrashed, setShowTrashed] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; category: VendorCategory | null }>({ open: false, category: null });
  const [forceDelete, setForceDelete] = useState<VendorCategory | null>(null);

  const listQuery = useQuery({
    queryKey: ['vendor-categories', { trashed: showTrashed }],
    queryFn: () => categoriesApi.list({ per_page: 100, trashed: showTrashed || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => {
      toast('Category deleted');
      void qc.invalidateQueries({ queryKey: ['vendor-categories'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.restore(id),
    onSuccess: () => {
      toast('Category restored');
      void qc.invalidateQueries({ queryKey: ['vendor-categories'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Restore failed', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.toggle(id),
    onSuccess: (r) => {
      toast(r.is_active ? 'Category activated' : 'Category deactivated');
      void qc.invalidateQueries({ queryKey: ['vendor-categories'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise your menu or catalogue, and choose what customers see from the platform hierarchy"
        actions={
          tab === 'mine' ? (
            <Button size="sm" onClick={() => setModal({ open: true, category: null })}>
              <Plus className="h-4 w-4" /> New category
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex rounded-lg bg-ink-50 p-0.5 sm:w-fit">
        {(
          [
            { id: 'mine', label: 'My categories', icon: List },
            { id: 'platform', label: 'Platform categories', icon: FolderTree },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        <>
          <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showTrashed}
              onChange={(e) => setShowTrashed(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            Show trashed categories
          </label>

          <Card className="px-0 py-0">
            {listQuery.isLoading ? (
              <Skeleton className="p-6" />
            ) : listQuery.isError || !listQuery.data ? (
              <ErrorState onRetry={() => void listQuery.refetch()} />
            ) : listQuery.data.data.length === 0 ? (
              <ErrorState message={showTrashed ? 'No trashed categories.' : 'No categories yet. Create one to get started.'} />
            ) : (
              <Table>
                <THead>
                  <THeadRow>
                    <THeadCell>Name</THeadCell>
                    <THeadCell>Scope</THeadCell>
                    <THeadCell className="text-right">Products</THeadCell>
                    <THeadCell className="text-right">Children</THeadCell>
                    <THeadCell>Status</THeadCell>
                    <THeadCell className="text-right">Actions</THeadCell>
                  </THeadRow>
                </THead>
                <TBody>
                  {listQuery.data.data.map((c) => (
                    <TRow key={c.id} className={cn(c.deleted_at && 'opacity-60')}>
                      <TCell>
                        <p className="font-medium text-neutral-900">{c.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          /{c.slug ?? c.id}
                          {c.parent ? ` · in ${c.parent.name}` : ''}
                          {c.deleted_at ? ' · trashed' : ''}
                        </p>
                      </TCell>
                      <TCell className="text-sm text-neutral-500">
                        {c.restaurant_id ? 'This restaurant' : c.store_id ? 'This store' : 'All outlets'}
                      </TCell>
                      <TCell className="text-right tabular-nums">{c.products_count}</TCell>
                      <TCell className="text-right tabular-nums">{c.children_count}</TCell>
                      <TCell>
                        {c.deleted_at ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">Deleted</span>
                        ) : (
                          <Switch checked={c.is_active} disabled={toggleMutation.isPending} onChange={() => toggleMutation.mutate(c.id)} label="" aria-label={`Toggle ${c.name}`} />
                        )}
                      </TCell>
                      <TCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.deleted_at ? (
                            <>
                              <Button size="sm" variant="outline" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(c.id)}>
                                <Undo2 className="h-4 w-4" /> Restore
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setForceDelete(c)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, category: c })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {c.products_count > 0 ? (
                                <Button size="sm" variant="ghost" onClick={() => setForceDelete(c)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(c.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TCell>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <PlatformTab />
      )}

      {modal.open && <CategoryModal category={modal.category} onClose={() => setModal({ open: false, category: null })} />}
      {forceDelete && <ForceDeleteModal category={forceDelete} onClose={() => setForceDelete(null)} />}
    </>
  );
}

type FlatPlatformRow = { node: PlatformCategoryView['categories'][number]; depth: number; path: string[] };

function flattenPlatform(nodes: PlatformCategoryView['categories'], depth: number, path: string[], out: FlatPlatformRow[]) {
  for (const n of nodes) {
    out.push({ node: n, depth, path });
    if (n.children?.length) flattenPlatform(n.children, depth + 1, [...path, n.name], out);
  }
  return out;
}

function descendantsOf(id: number, nodes: PlatformCategoryView['categories'], acc: number[] = []): number[] {
  for (const n of nodes) {
    if (n.id === id) {
      for (const c of n.children ?? []) {
        acc.push(c.id);
        descendantsOf(c.id, nodes, acc);
      }
      return acc;
    }
    if (n.children?.length) descendantsOf(id, n.children, acc);
  }
  return acc;
}

function leafIds(nodes: PlatformCategoryView['categories']): number[] {
  const out: number[] = [];
  for (const n of nodes) {
    if (n.children?.length) leafIds(n.children).forEach((id) => out.push(id));
    else out.push(n.id);
  }
  return out;
}

function PlatformTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-platform-categories'],
    queryFn: () => categoriesApi.platform(),
  });
  const [selection, setSelection] = useState<Set<number> | null>(null);

  const syncMutation = useMutation({
    mutationFn: (ids: number[]) => categoriesApi.syncPlatform(ids),
    onSuccess: (r) => {
      setSelection(new Set(r.selected_category_ids));
      toast('Platform categories updated — customers will see these in your outlet');
      void qc.invalidateQueries({ queryKey: ['vendor-platform-categories'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  if (isLoading) return <Skeleton className="py-10" />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const serverSet = new Set(data.selected_category_ids);
  const current = selection ?? serverSet;
  const rows = flattenPlatform(data.categories, 0, [], []);
  const leaves = leafIds(data.categories);

  const toggle = (id: number) => {
    setSelection((prev) => {
      const base = prev ?? serverSet;
      const next = new Set(base);
      const ids = [id, ...descendantsOf(id, data.categories)];
      const allOn = ids.every((i) => next.has(i));
      ids.forEach((i) => (allOn ? next.delete(i) : next.add(i)));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {data.outlet && (
        <Card className="flex items-center gap-3 border-brand-200 bg-brand-50/30 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <Store className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{data.outlet.name}</p>
            <p className="text-xs text-neutral-500">
              These selections control which {data.service_type === 'food' ? 'food' : 'grocery'} categories appear under your outlet on the customer app.
            </p>
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 pb-3">
          <input
            type="checkbox"
            checked={leaves.length > 0 && leaves.every((id) => current.has(id))}
            disabled={syncMutation.isPending}
            onChange={() => setSelection(leaves.every((id) => current.has(id)) ? new Set() : new Set(leaves))}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          <span className="text-sm text-neutral-600">
            Select all leaf categories <span className="text-neutral-400">({data.selected_category_ids.length} of {leaves.length} currently shown)</span>
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelection(new Set(serverSet))} disabled={syncMutation.isPending}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button size="sm" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate([...current])}>
              <Save className="h-4 w-4" /> {syncMutation.isPending ? 'Saving…' : `Save (${current.size} selected)`}
            </Button>
          </div>
        </div>

        {rows.map(({ node, depth, path }) => (
          <label
            key={node.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-ink-50"
            style={{ paddingLeft: `${depth * 22 + 8}px` }}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
              checked={current.has(node.id)}
              onChange={() => toggle(node.id)}
            />
            {node.image && <img src={node.image} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />}
            <span className="min-w-0 truncate font-medium text-neutral-800">{node.name}</span>
            <span className="shrink-0 text-xs text-neutral-400">
              {node.children_count ? `${node.children_count} sub-categories` : node.products_count != null ? `${node.products_count} products` : ''}
            </span>
            {path.length > 0 && <span className="shrink-0 text-xs text-neutral-400">· {path.join(' › ')}</span>}
          </label>
        ))}

        {rows.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-neutral-400">No platform categories available for {data.service_type} yet.</p>
        )}
      </Card>
    </div>
  );
}
function CategoryImageField({
  value,
  category,
  uploading,
  onUpload,
  onChange,
  onError,
}: {
  value: string;
  category: VendorCategory | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<{ image: string }>;
  onChange: (image: string) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (category && value === (category.image ?? '')) {
        await categoriesApi.removeImage(category.id);
      }
    },
    onSuccess: () => onChange(''),
    onError: (err) => onError(err instanceof Error ? err.message : 'Remove failed'),
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onError('Image must be smaller than 4MB');
      return;
    }
    try {
      const { image } = await onUpload(file);
      onChange(image);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Image</span>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <img src={value} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">Shown as this category's thumbnail.</span>
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
              <Button type="button" size="sm" variant="ghost" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
                <Trash2 className="h-4 w-4 text-red-500" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading || removeMutation.isPending}
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-300 text-neutral-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Upload image'}</span>
          <span className="text-xs text-neutral-400">PNG, JPG or WebP · up to 4MB</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </>
  );
}
