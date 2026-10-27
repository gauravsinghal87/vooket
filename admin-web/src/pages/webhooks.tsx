import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, History, Plus, RadioTower, RefreshCw, Trash2, Pencil, Zap } from 'lucide-react';
import { webhooksApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AdminWebhookSubscription, WebhookDelivery, WebhookEventDefinition } from '@/typings/models';

const fallbackEvents: WebhookEventDefinition[] = [
  { name: 'order.created', description: 'A new order was placed.' },
  { name: 'order.updated', description: 'Order state changed.' },
  { name: 'payment.captured', description: 'Payment captured.' },
  { name: 'ping', description: 'Test ping event.' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-neutral-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

const deliveryTone: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  delivered: 'success',
  failed: 'danger',
  pending: 'info',
  retrying: 'warning',
};

function SubscriptionsPageBody() {
  const qc = useQueryClient();
  const [draftOpen, setDraftOpen] = useState(false);
  const [edit, setEdit] = useState<AdminWebhookSubscription | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<AdminWebhookSubscription | null>(null);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [statusOn, setStatusOn] = useState(true);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: () => webhooksApi.list(),
  });

  const health = useQuery({
    queryKey: ['webhooks-health'],
    queryFn: () => webhooksApi.health(),
    retry: false,
  });

  const events = health.data?.events?.length ? health.data.events : fallbackEvents;

  const openCreate = () => {
    setEdit(null);
    setUrl('');
    setSelectedEvents([]);
    setStatusOn(true);
    setDraftOpen(true);
  };

  const openEdit = (sub: AdminWebhookSubscription) => {
    setEdit(sub);
    setUrl(sub.target_url);
    setSelectedEvents(sub.events);
    setStatusOn(sub.status);
    setDraftOpen(true);
  };

  const closeDraft = () => {
    setDraftOpen(false);
    setEdit(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (edit) return webhooksApi.update(edit.id, { target_url: url, events: selectedEvents, status: statusOn });
      return webhooksApi.create({ target_url: url, events: selectedEvents });
    },
    onSuccess: (res) => {
      toast(edit ? 'Subscription updated' : 'Webhook subscription created');
      if (!edit && res.secret) setCreatedSecret(res.secret);
      void qc.invalidateQueries({ queryKey: ['admin-webhooks'] });
      if (!edit) setDraftOpen(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.remove(id),
    onSuccess: () => {
      toast('Subscription deleted');
      void qc.invalidateQueries({ queryKey: ['admin-webhooks'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const pingMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.ping(id),
    onSuccess: () => toast('Test ping dispatched'),
    onError: (err) => toast(err instanceof Error ? err.message : 'Ping failed', 'error'),
  });

  const subscriptions = data?.length ? data : [];
  const canSave = url.trim().length > 0 && selectedEvents.length > 0;

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Outbound event subscriptions for partners and merchants"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add subscription
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="py-6" />
      ) : isError ? (
        <ErrorState message="Failed to load webhook subscriptions" onRetry={() => void refetch()} />
      ) : subscriptions.length === 0 ? (
        <ErrorState message="No webhook subscriptions yet" onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 px-0 pt-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RadioTower className="h-4 w-4 text-brand-500" />
                    <span className="break-all font-mono text-sm text-neutral-800">{sub.target_url}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(sub.events ?? []).map((e) => (
                      <Badge key={e} tone="info">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-400">
                    Created {new Date(sub.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-semibold text-neutral-500">{sub.status ? 'Active' : 'Paused'}</span>
                  <Toggle checked={sub.status} onChange={(v) => webhooksApi.update(sub.id, { status: v })
                    .then(() => {
                      void qc.invalidateQueries({ queryKey: ['admin-webhooks'] });
                      toast('Subscription ' + (v ? 'activated' : 'paused'));
                    })
                    .catch((err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'))}
                  />
                </div>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setDeliveriesFor(sub)} disabled={pingMutation.isPending && pingMutation.variables === sub.id}>
                  {pingMutation.isPending && pingMutation.variables === sub.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <History className="h-3.5 w-3.5" />
                  )}
                  Deliveries
                </Button>
                <Button size="sm" variant="outline" onClick={() => pingMutation.mutate(sub.id)}>
                  <Zap className="h-3.5 w-3.5" /> Ping test
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(sub)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (window.confirm('Delete this webhook subscription?')) removeMutation.mutate(sub.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={draftOpen}
        onOpenChange={(open) => {
          if (!open) closeDraft();
        }}
        title={edit ? 'Edit subscription' : 'Add webhook subscription'}
        description="Events fire as JSON POSTs to the endpoint below"
      >
        {createdSecret ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Signing secret (shown once)</p>
              <p className="mt-1 font-mono text-xs break-all text-emerald-700">{createdSecret}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  void navigator.clipboard.writeText(createdSecret);
                  toast('Secret copied to clipboard');
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy secret
              </Button>
            </div>
            <Button className="w-full" onClick={() => { setCreatedSecret(null); }}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Endpoint URL</label>
              <Input
                placeholder="https://merchant.example.com/webhooks/orders"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Events</label>
              {health.isError && (
                <p className="mb-2 text-[11px] text-amber-600">
                  Event catalog unavailable — showing a default subset.
                </p>
              )}
              <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-ink-100 p-3 sm:grid-cols-2">
                {events.map((ev) => {
                  const checked = selectedEvents.includes(ev.name);
                  return (
                    <label
                      key={ev.name}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors',
                        checked ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:bg-ink-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() =>
                          setSelectedEvents((prev) =>
                            checked ? prev.filter((e) => e !== ev.name) : [...prev, ev.name]
                          )
                        }
                      />
                      <span>
                        <span className="block font-mono text-xs font-semibold text-neutral-800">{ev.name}</span>
                        {ev.description && <span className="block text-[11px] text-neutral-500">{ev.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {edit && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-800">Active</p>
                  <p className="text-xs text-neutral-400">Pause delivery without deleting the subscription.</p>
                </div>
                <Toggle checked={statusOn} onChange={setStatusOn} />
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
              <Button variant="ghost" size="sm" onClick={closeDraft}>
                Cancel
              </Button>
              <Button size="sm" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? 'Saving…' : edit ? 'Save changes' : 'Create subscription'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <DeliveriesModal
        subscription={deliveriesFor}
        onClose={() => setDeliveriesFor(null)}
      />
    </>
  );
}

function DeliveriesModal({
  subscription,
  onClose,
}: {
  subscription: AdminWebhookSubscription | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['webhook-deliveries', subscription?.id],
    queryFn: () => (subscription ? webhooksApi.deliveries(subscription.id) : []),
    enabled: !!subscription,
  });

  const deliveries = useMemo(() => data ?? ([] as WebhookDelivery[]), [data]);

  return (
    <Modal
      open={!!subscription}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      wide
      title="Webhook deliveries"
      description={subscription?.target_url}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-400">
          Latest {Math.min(deliveries.length, 50)} attempts
          {dataUpdatedAt ? ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </p>
        {subscription && (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton rows={4} className="py-4" />
      ) : isError ? (
        <ErrorState message="Failed to load deliveries" onRetry={() => void refetch()} />
      ) : deliveries.length === 0 ? (
        <ErrorState message="No deliveries recorded yet. Try a ping test." />
      ) : (
        <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
          {deliveries.map((d) => (
            <div key={d.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-neutral-800">{d.event}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={deliveryTone[d.status] ?? 'neutral'}>{d.status}</Badge>
                  <span className="text-[11px] text-neutral-400">attempts: {d.attempts}</span>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500">
                Sent {new Date(d.created_at).toLocaleString()}
                {d.delivered_at ? ` · delivered ${new Date(d.delivered_at).toLocaleString()}` : ''}
              </p>
              {d.last_error && <p className="mt-1 text-[11px] text-red-600">{d.last_error}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function WebhooksPage() {
  return <SubscriptionsPageBody />;
}