import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Eye, FolderTree, List, Loader2, Pencil, Plus, Search, Star, Trash2, Undo2, Upload, ListPlus, Settings2 } from 'lucide-react';
import { categoriesApi } from '@/repositories/admin';
import type { AdminCategory, CategoryDisplayPlacement, CategoryServiceType } from '@/typings/models';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Field } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/controls';
import { Pagination } from '@/components/ui/pagination';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: { value: CategoryServiceType; label: string }[] = [
  { value: 'food', label: 'Food & Delivery' },
  { value: 'grocery', label: 'Grocery & Retail' },
  { value: 'rides', label: 'Rides & Mobility' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const PLACEMENT_OPTIONS: { value: CategoryDisplayPlacement; label: string; hint: string }[] = [
  { value: 'top_navigation', label: 'Top Navigation Only', hint: 'Sticky category strip below the search bar' },
  { value: 'main_content', label: 'Main Content Only', hint: 'Category cards in the main content area' },
  { value: 'both', label: 'Both', hint: 'Top navigation and main content' },
];

interface FormState {
  name: string;
  slug: string;
  type: CategoryServiceType;
  parent_id: number | '';
  icon: string;
  image: string;
  navigation_icon: string;
  display_placement: CategoryDisplayPlacement;
  description: string;
  sort_order: number | '';
  is_active: boolean;
  is_featured: boolean;
  meta_title: string;
  meta_description: string;
}

interface TreeNode extends AdminCategory {
  depth: number;
}

function flattenTree(nodes: AdminCategory[], depth = 0): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth, parent_id: n.parent_id ?? null });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

function descendantIds(nodes: Array<{ id: number; parent_id: number | null }>, id: number): Set<number> {
  const out = new Set<number>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as number;
    for (const n of nodes) {
      if (n.parent_id === current && !out.has(n.id)) {
        out.add(n.id);
        stack.push(n.id);
      }
    }
  }
  return out;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  type: 'food',
  parent_id: '',
  icon: '',
  image: '',
  navigation_icon: '',
  display_placement: 'both',
  description: '',
  sort_order: 0,
  is_active: true,
  is_featured: false,
  meta_title: '',
  meta_description: '',
};

function formFromCategory(c: AdminCategory): FormState {
  return {
    name: c.name,
    slug: c.slug ?? '',
    type: c.type,
    parent_id: c.parent_id ?? '',
    icon: c.icon ?? '',
    image: c.image ?? '',
    navigation_icon: c.navigation_icon ?? '',
    display_placement: c.display_placement ?? 'both',
    description: c.description ?? '',
    sort_order: c.sort_order,
    is_active: c.is_active,
    is_featured: c.is_featured,
    meta_title: c.meta_title ?? '',
    meta_description: c.meta_description ?? '',
  };
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'tree'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [serviceType, setServiceType] = useState<CategoryServiceType | ''>('');
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('');
  const [showTrashed, setShowTrashed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cascade, setCascade] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [detail, setDetail] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-categories', { page, search, serviceType: serviceType || null, status: status || null, trashed: showTrashed }],
    queryFn: () =>
      categoriesApi.list({
        page,
        per_page: 20,
        search: search || null,
        service_type: serviceType || null,
        status: status || null,
        trashed: showTrashed || null,
      }),
  });

  const treeQuery = useQuery({
    queryKey: ['admin-categories-tree', { serviceType: serviceType || null, trashed: showTrashed }],
    queryFn: () => categoriesApi.tree(serviceType || undefined),
  });

  const detailQuery = useQuery({
    queryKey: ['admin-category-detail', detail],
    queryFn: () => categoriesApi.get(detail as number),
    enabled: detail !== null,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-categories'] });
    void qc.invalidateQueries({ queryKey: ['admin-categories-tree'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? categoriesApi.update(editing.id, payload) : categoriesApi.create(payload),
    onSuccess: () => {
      toast(editing ? 'Category updated' : 'Category created');
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Save failed'),
  });

  const saveUploadMutation = useMutation({
    mutationFn: (file: File) => categoriesApi.uploadImage(file),
  });

  const navIconUploadMutation = useMutation({
    mutationFn: (file: File) => categoriesApi.uploadNavigationIcon(file),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: number; force?: boolean }) => categoriesApi.remove(id, force),
    onSuccess: () => {
      toast('Category deleted');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, cascade: c }: { id: number; cascade?: boolean }) => categoriesApi.toggle(id, c),
    onSuccess: (r) => {
      toast(`Category ${r.is_active ? 'activated' : 'deactivated'}`);
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const featuredMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.toggleFeatured(id),
    onSuccess: (r) => {
      toast(r.is_featured ? 'Category featured' : 'Category unfeatured');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const recycleMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.restore(id),
    onSuccess: () => {
      toast('Category restored');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Restore failed', 'error'),
  });

  const bulkMutation = useMutation({
    mutationFn: (action: 'activate' | 'deactivate' | 'delete' | 'restore') =>
      categoriesApi.bulk(action, [...selected], cascade),
    onSuccess: (_r, action) => {
      toast(`Bulk ${action} applied to ${selected.size} categor${selected.size === 1 ? 'y' : 'ies'}`);
      setSelected(new Set());
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Bulk action failed', 'error'),
  });

  const allTreeItems = useMemo(() => flattenTree(treeQuery.data ?? []), [treeQuery.data]);

  const parentOptions = useMemo(() => {
    const excluded = editing ? descendantIds(allTreeItems, editing.id) : new Set<number>();
    return allTreeItems.filter((n) => n.type === form.type && !excluded.has(n.id));
  }, [allTreeItems, form.type, editing]);

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sort_order: number }[]) => categoriesApi.reorder(items),
    onSuccess: () => {
      toast('Reordered');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Reorder failed', 'error'),
  });

  const move = (id: number, dir: -1 | 1) => {
    const node = allTreeItems.find((n) => n.id === id);
    if (!node) return;
    const siblings = allTreeItems.filter((n) => n.parent_id === node.parent_id);
    const idx = siblings.findIndex((n) => n.id === id);
    if (idx < 0 || (dir === -1 && idx === 0) || (dir === 1 && idx === siblings.length - 1)) return;
    const next = [...siblings];
    const [a] = next.splice(idx, 1);
    next.splice(idx + dir, 0, a);
    reorderMutation.mutate(next.map((n, i) => ({ id: n.id, sort_order: i })));
  };

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleHierarchy = useMemo(() => {
    return allTreeItems.filter((n) => {
      const keep = showTrashed ? n.deleted_at !== undefined : n.deleted_at === undefined;
      if (!keep) return false;
      let parent = n.parent_id;
      while (parent !== null) {
        if (collapsed.has(parent)) return false;
        const p = allTreeItems.find((f) => f.id === parent);
        parent = p ? p.parent_id : null;
      }
      return true;
    });
  }, [allTreeItems, collapsed, showTrashed]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, type: serviceType || 'food' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: AdminCategory) => {
    setEditing(c);
    setForm(formFromCategory(c));
    setFormError(null);
    setFormOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Name is required.');
    saveMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      type: form.type,
      parent_id: form.parent_id === '' ? null : Number(form.parent_id),
      icon: form.icon.trim() || null,
      image: form.image.trim() || null,
      navigation_icon: form.navigation_icon.trim() || null,
      display_placement: form.display_placement,
      description: form.description.trim() || null,
      sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      is_active: form.is_active,
      is_featured: form.is_featured,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = (listQuery.data?.data ?? []).map((c) => c.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const rows = listQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Manage the catalog categories used across restaurant, retail and ride services."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <Card className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              className="pl-9"
              placeholder="Search by name or slug…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-48"
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value as CategoryServiceType | '');
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Select
            className="w-40"
            value={status}
            disabled={showTrashed}
            onChange={(e) => {
              setStatus(e.target.value as 'active' | 'inactive' | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <ToggleView view={view} onChange={setView} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
          <Checkbox
            label="Include trashed"
            checked={showTrashed}
            onChange={(e) => {
              setShowTrashed(e.target.checked);
              setPage(1);
            }}
          />
          <span className="text-xs text-neutral-400">
            {showTrashed ? 'Deleted categories can be restored or permanently removed.' : 'Deleting a category first moves it to trash.'}
          </span>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50/40 py-3">
          <span className="text-sm font-medium text-neutral-700">{selected.size} selected</span>
          <Checkbox label="Apply to children too" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
          <div className="ml-auto flex flex-wrap gap-2">
            {showTrashed ? (
              <Button size="sm" onClick={() => bulkMutation.mutate('restore')} disabled={bulkMutation.isPending}>
                <Undo2 className="h-4 w-4" /> Restore
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('activate')} disabled={bulkMutation.isPending}>
                  Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('deactivate')} disabled={bulkMutation.isPending}>
                  Deactivate
                </Button>
              </>
            )}
            <Button size="sm" variant="danger" onClick={() => bulkMutation.mutate('delete')} disabled={bulkMutation.isPending}>
              <Trash2 className="h-4 w-4" /> {showTrashed ? 'Delete forever' : 'Move to trash'}
            </Button>
          </div>
        </Card>
      )}

      {view === 'list' ? (
        listQuery.isLoading ? (
          <Skeleton className="py-10" />
        ) : rows.length === 0 ? (
          <ErrorState message={showTrashed ? 'No trashed categories match.' : 'No categories found. Create one to get started.'} />
        ) : (
          <>
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/60 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">
                      <Checkbox
                        label=""
                        aria-label="Select all on page"
                        checked={rows.length > 0 && rows.every((c) => selected.has(c.id))}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Featured</th>
                    <th className="px-4 py-3 text-right">Children</th>
                    <th className="px-4 py-3 text-right">Products</th>
                    <th className="px-4 py-3">Sort</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {rows.map((c) => (
                    <tr key={c.id} className={cn('hover:bg-ink-50/40', c.deleted_at && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <Checkbox label="" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CategoryAvatar category={c} />
                          <div>
                            <p className="flex items-center gap-1.5 font-medium text-neutral-900">
                              {c.name}
                              {c.navigation_icon && (
                                <img src={c.navigation_icon} alt="" title="Top navigation icon" className="h-4 w-4 shrink-0 object-contain" />
                              )}
                            </p>
                            <p className="text-xs text-neutral-400">
                              /{c.slug}{c.parent ? ` · in ${c.parent.name}` : ''}{c.deleted_at ? ' · trashed' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.type} className="capitalize" />
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={c.is_active}
                          disabled={toggleMutation.isPending}
                          onChange={() => toggleMutation.mutate({ id: c.id, cascade })}
                          label=""
                          aria-label={`Toggle ${c.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StarToggle featured={c.is_featured} disabled={featuredMutation.isPending} onClick={() => featuredMutation.mutate(c.id)} label={c.name} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{c.children_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{c.products_count}</td>
                      <td className="px-4 py-3 tabular-nums text-neutral-600">{c.sort_order}</td>
                      <td className="px-4 py-3">
                        <RowActions
                          deleted={Boolean(c.deleted_at)}
                          onView={() => setDetail(c.id)}
                          onEdit={() => openEdit(c)}
                          onDelete={() => deleteMutation.mutate({ id: c.id })}
                          onDeleteForever={() => deleteMutation.mutate({ id: c.id, force: true })}
                          onRestore={() => recycleMutation.mutate(c.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {listQuery.data && listQuery.data.last_page > 1 && (
              <div className="mt-4 flex justify-end">
                <Pagination page={page} lastPage={listQuery.data.last_page} total={listQuery.data.total} onChange={setPage} />
              </div>
            )}
          </>
        )
      ) : treeQuery.isLoading ? (
        <Skeleton className="py-10" />
      ) : visibleHierarchy.length === 0 ? (
        <ErrorState message="No categories to display in this view." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Category hierarchy</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {visibleHierarchy.map((c) => (
                <tr key={c.id} className={cn('hover:bg-ink-50/40', c.deleted_at && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center" style={{ paddingLeft: `${c.depth * 28}px` }}>
                      {c.children_count > 0 ? (
                        <button
                          type="button"
                          className="mr-1 flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-ink-50 hover:text-neutral-700"
                          onClick={() => toggleCollapse(c.id)}
                          aria-label={collapsed.has(c.id) ? 'Expand' : 'Collapse'}
                        >
                          {collapsed.has(c.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="mr-1 w-5" />
                      )}
                      <CategoryAvatar category={c} />
                      <div className="ml-3">
                        <p className="flex items-center gap-1.5 font-medium text-neutral-900">
                          {c.name}
                          {c.navigation_icon && (
                            <img src={c.navigation_icon} alt="" title="Top navigation icon" className="h-4 w-4 shrink-0 object-contain" />
                          )}
                        </p>
                        <p className="text-xs text-neutral-400">/{c.slug}{c.deleted_at ? ' · trashed' : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={c.is_active}
                      disabled={toggleMutation.isPending}
                      onChange={() => toggleMutation.mutate({ id: c.id, cascade })}
                      label=""
                      aria-label={`Toggle ${c.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StarToggle featured={c.is_featured} disabled={featuredMutation.isPending} onClick={() => featuredMutation.mutate(c.id)} label={c.name} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{c.products_count}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      tree
                      deleted={Boolean(c.deleted_at)}
                      onView={() => setDetail(c.id)}
                      onMoveUp={() => move(c.id, -1)}
                      onMoveDown={() => move(c.id, 1)}
                      onEdit={() => openEdit(c)}
                      onDelete={() => deleteMutation.mutate({ id: c.id })}
                      onDeleteForever={() => deleteMutation.mutate({ id: c.id, force: true })}
                      onRestore={() => recycleMutation.mutate(c.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) setFormOpen(false);
        }}
        wide
        title={editing ? `Edit ${editing.name}` : 'New category'}
        description="Categories are shared across services and can be nested for richer browsing."
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Burgers" />
            </Field>
            <Field label="Slug" hint="Optional — auto-generated from name if empty.">
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="burgers" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Service type" required>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CategoryServiceType, parent_id: '' })}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Parent category" hint="Leave empty to make this a top-level category.">
              <Select
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value === '' ? '' : Number(e.target.value) })}
              >
                <option value="">None (top-level)</option>
                {parentOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {'— '.repeat(n.depth + 1)}{n.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description shown to customers." />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MediaUploadField
              label="Main category image"
              hint="Large tile image shown in the grocery category grid."
              emptyHint="PNG, JPG or WebP · up to 4MB"
              value={form.image}
              uploading={saveUploadMutation.isPending}
              onUpload={async (file) => (await categoriesApi.uploadImage(file)).image}
              onRemove={async () => {
                if (editing && form.image === (editing.image ?? '')) {
                  await categoriesApi.removeImage(editing.id);
                }
              }}
              onChange={(image) => setForm({ ...form, image })}
              onError={(msg) => toast(msg, 'error')}
            />
            <MediaUploadField
              label="Top navigation icon"
              hint="Small icon shown in the sticky grocery category strip. Categories without one show a neutral fallback."
              emptyHint="Square PNG/WebP · up to 2MB"
              value={form.navigation_icon}
              uploading={navIconUploadMutation.isPending}
              maxSizeMb={2}
              onUpload={async (file) => (await categoriesApi.uploadNavigationIcon(file)).navigation_icon}
              onRemove={async () => {
                if (editing && form.navigation_icon === (editing.navigation_icon ?? '')) {
                  await categoriesApi.removeNavigationIcon(editing.id);
                }
              }}
              onChange={(navigation_icon) => setForm({ ...form, navigation_icon })}
              onError={(msg) => toast(msg, 'error')}
            />
          </div>
          <Field
            label="Display placement"
            hint={PLACEMENT_OPTIONS.find((o) => o.value === form.display_placement)?.hint}
          >
            <Select
              value={form.display_placement}
              onChange={(e) => setForm({ ...form, display_placement: e.target.value as CategoryDisplayPlacement })}
            >
              {PLACEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Icon name" hint="Optional Lucide icon key used by other service UIs.">
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="utensils-crossed" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Sort order">
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value === '' ? '' : Number(e.target.value) })} />
            </Field>
            <div className="flex items-end pb-1">
              <Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" />
            </div>
            <div className="flex items-end pb-1">
              <Switch checked={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} label="Featured" />
            </div>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <Settings2 className="h-3.5 w-3.5" /> SEO
            </p>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Meta title">
                <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} />
              </Field>
              <Field label="Meta description">
                <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <ListPlus className="h-4 w-4" /> {editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        wide
        title={detailQuery.data?.name ?? 'Category details'}
      >
        {detailQuery.isLoading ? (
          <Skeleton className="py-8" />
        ) : detailQuery.isError ? (
          <ErrorState message="Could not load category details." onRetry={() => void detailQuery.refetch()} />
        ) : detailQuery.data ? (
          <DetailView category={detailQuery.data} />
        ) : null}
      </Modal>
    </>
  );
}

function MediaUploadField({
  label,
  hint,
  emptyHint,
  value,
  uploading,
  maxSizeMb = 4,
  onUpload,
  onRemove,
  onChange,
  onError,
}: {
  label: string;
  hint: string;
  emptyHint: string;
  value: string;
  uploading: boolean;
  maxSizeMb?: number;
  onUpload: (file: File) => Promise<string>;
  onRemove: () => Promise<void>;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const removeMutation = useMutation({
    mutationFn: onRemove,
    onSuccess: () => onChange(''),
    onError: (err) => onError(err instanceof Error ? err.message : 'Remove failed'),
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      onError(`Image must be smaller than ${maxSizeMb}MB`);
      return;
    }
    try {
      onChange(await onUpload(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <img src={value} alt="" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">{hint}</span>
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
          <span className="text-sm font-medium">{uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}</span>
          <span className="text-xs text-neutral-400">{emptyHint}</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function CategoryAvatar({ category }: { category: AdminCategory }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-xs font-bold uppercase text-brand-700">
      {category.image ? <img src={category.image} alt="" className="h-9 w-9 object-cover" /> : category.name.slice(0, 2)}
    </div>
  );
}

function ToggleView({ view, onChange }: { view: 'list' | 'tree'; onChange: (v: 'list' | 'tree') => void }) {
  return (
    <div className="flex rounded-lg bg-ink-50 p-0.5">
      {(
        [
          { id: 'list', label: 'List', icon: List },
          { id: 'tree', label: 'Tree', icon: FolderTree },
        ] as const
      ).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            view === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
          )}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function StarToggle({ featured, disabled, onClick, label }: { featured: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Toggle featured for ${label}`}
      className={cn('text-neutral-300 transition-colors hover:text-amber-500 disabled:opacity-50', featured && 'text-amber-400')}
    >
      <Star className={cn('h-4 w-4', featured && 'fill-amber-400 text-amber-400')} />
    </button>
  );
}

function RowActions({
  deleted,
  tree,
  onView,
  onEdit,
  onDelete,
  onDeleteForever,
  onRestore,
  onMoveUp,
  onMoveDown,
}: {
  deleted: boolean;
  tree?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteForever: () => void;
  onRestore: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <IconAction title="Details" onClick={onView}>
        <Eye className="h-4 w-4" />
      </IconAction>
      {tree && (
        <>
          <IconAction title="Move up" onClick={onMoveUp as () => void}>
            <ChevronDown className="h-4 w-4 rotate-180" />
          </IconAction>
          <IconAction title="Move down" onClick={onMoveDown as () => void}>
            <ChevronDown className="h-4 w-4" />
          </IconAction>
        </>
      )}
      {deleted ? (
        <>
          <IconAction title="Restore" onClick={onRestore}>
            <Undo2 className="h-4 w-4" />
          </IconAction>
          <IconAction title="Delete forever" danger onClick={onDeleteForever}>
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </>
      ) : (
        <>
          <IconAction title="Edit" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconAction>
          <IconAction title="Delete" danger onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </>
      )}
    </div>
  );
}

function IconAction({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-ink-50',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:text-neutral-900'
      )}
    >
      {children}
    </button>
  );
}

function DetailView({ category }: { category: AdminCategory }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <CategoryAvatar category={category} />
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
            {category.name}
            {category.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <Star className="h-3 w-3 fill-amber-400" /> Featured
              </span>
            )}
          </p>
          <p className="text-sm text-neutral-400">/{category.slug}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Type" value={TYPE_LABEL[category.type] ?? category.type} />
        <Stat label="Status" value={category.is_active ? 'Active' : 'Inactive'} />
        <Stat label="Children" value={String(category.children_count)} />
        <Stat label="Products" value={String(category.products_count)} />
      </div>

      {category.parent && (
        <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm">
          <span className="text-neutral-400">Parent: </span>
          <span className="font-medium text-neutral-800">{category.parent.name}</span>
          <span className="text-neutral-400"> — /{category.parent.slug}</span>
        </div>
      )}

      {category.description && (
        <p className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-800">Description: </span>
          {category.description}
        </p>
      )}

      {category.navigation_icon && (
        <div className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3 text-sm">
          <img src={category.navigation_icon} alt="" className="h-8 w-8 shrink-0 object-contain" />
          <span className="text-neutral-500">Top navigation icon</span>
        </div>
      )}

      {category.children && category.children.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Direct children</p>
          <div className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <span key={child.id} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700">
                {child.image && <img src={child.image} alt="" className="mr-1.5 inline h-4 w-4 rounded object-cover" />}
                {child.name} <span className="text-neutral-400">· {child.products_count} products</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {category.meta_title || category.meta_description ? (
        <div className="rounded-xl border border-ink-100 p-4 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">SEO</p>
          {category.meta_title && <p className="font-medium text-neutral-800">{category.meta_title}</p>}
          {category.meta_description && <p className="text-neutral-500">{category.meta_description}</p>}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
        {category.deleted_at && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600">Deleted {formatDate(category.deleted_at)}</span>
        )}
        {category.created_at && <span>Created {formatDate(category.created_at)}</span>}
        {category.updated_at && <span>Updated {formatDate(category.updated_at)}</span>}
        <span>ID #{category.id}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-sm font-semibold capitalize text-neutral-900">{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}