import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { rolesApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import type { AdminPermission } from '@/typings/models';

type EditorState = {
  id: number | null;
  name: string;
  catalog: AdminPermission[];
  assigned: Set<number>;
};

export function RolesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => rolesApi.list(),
  });

  const [open, setOpen] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ id: null, name: '', catalog: [], assigned: new Set() });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const role = await rolesApi.create(name);
      if (editor.assigned.size > 0) {
        await rolesApi.updatePermissions(role.id, [...editor.assigned]);
      }
    },
    onSuccess: () => {
      toast('Role created');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Create failed', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: number[] }) => rolesApi.updatePermissions(id, permissions),
    onSuccess: () => {
      toast('Permissions updated');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const openEditor = async (id: number | null, name: string) => {
    setLoadingEditor(true);
    setOpen(true);
    setEditor({ id, name, catalog: [], assigned: new Set() });
    try {
      const seedId = id ?? data?.[0]?.id;
      if (seedId) {
        const detail = await rolesApi.get(seedId);
        setEditor({
          id,
          name,
          catalog: detail.permissions,
          assigned: new Set((detail.role.permissions ?? []).map((p) => p.id)),
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load permissions', 'error');
    } finally {
      setLoadingEditor(false);
    }
  };

  const togglePerm = (id: number) => {
    const next = new Set(editor.assigned);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEditor({ ...editor, assigned: next });
  };

  const grouped = editor.catalog.reduce<Record<string, AdminPermission[]>>((acc, p) => {
    const m = p.module ?? 'General';
    (acc[m] ??= []).push(p);
    return acc;
  }, {});

  const save = () => {
    if (!editor.name) return;
    if (editor.id === null) createMutation.mutate(editor.name);
    else updateMutation.mutate({ id: editor.id, permissions: [...editor.assigned] });
  };

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Admin roles and access control"
        actions={
          <Button
            size="sm"
            onClick={() => void openEditor(null, '')}
          >
            <Plus className="h-4 w-4" /> New role
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <Skeleton className="py-10" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          (data ?? []).map((role) => (
            <Card key={role.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">{role.name}</p>
                  <p className="text-xs text-neutral-400">
                    <code className="rounded bg-ink-50 px-1.5 py-0.5">{role.slug}</code>
                    {typeof role.users_count === 'number' && ` · ${role.users_count} user${role.users_count === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {role.is_system && <StatusBadge status="system" />}
                  <Button size="sm" variant="ghost" onClick={() => void openEditor(role.id, role.name)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(role.permissions ?? []).map((p) => (
                  <span key={p.id} className="rounded-md bg-ink-50 px-2 py-0.5 font-mono text-[11px] text-neutral-600">
                    {p.slug}
                  </span>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card">
            <h2 className="text-lg font-bold text-neutral-900">{editor.id === null ? 'New role' : `Edit · ${editor.name}`}</h2>

            {editor.id === null && (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Role name</label>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Support agent" />
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-neutral-700">Permissions</p>
              {loadingEditor ? (
                <Skeleton rows={4} />
              ) : editor.catalog.length === 0 ? (
                <p className="rounded-lg bg-ink-50 px-3 py-4 text-sm text-neutral-500">
                  No permission catalog available. Assign roles via the seeded permissions in the database.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(grouped).map(([module, perms]) => (
                    <div key={module}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{module}</p>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-2 text-sm hover:bg-ink-50/60">
                            <input
                              type="checkbox"
                              checked={editor.assigned.has(p.id)}
                              onChange={() => togglePerm(p.id)}
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span>
                              <span className="block text-xs font-medium text-neutral-800">{p.name}</span>
                              <span className="block font-mono text-[10px] text-neutral-400">{p.slug}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={(editor.id === null && !editor.name) || loadingEditor || createMutation.isPending || updateMutation.isPending}
              >
                Save role
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}