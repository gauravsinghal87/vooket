import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/services/apiClient';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ErrorState } from '@/shared/components/ui/state';
import { toast } from '@/shared/components/ui/toast';
import { formatDateTime } from '@/shared/utils/utils';

const STATUS_LABEL: Record<string, string> = {
  open: 'Submitted',
  in_progress: 'Under review',
  pending: 'Under review',
  waiting_for_customer: 'Waiting for your response',
  waiting_for_vendor: 'Waiting for an internal team',
  waiting_for_driver: 'Waiting for an internal team',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Closed',
  approved: 'Resolved',
};

export function SupportTicketsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState('');

  const list = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => apiClient.get<any>('/support-tickets'),
  });

  const detail = useQuery({
    queryKey: ['support-ticket', selectedId],
    queryFn: () => apiClient.get<any>(`/support-tickets/${selectedId}`),
    enabled: selectedId != null,
  });

  const replyMut = useMutation({
    mutationFn: (body: { message: string }) => apiClient.post(`/support-tickets/${selectedId}/messages`, body),
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['support-ticket', selectedId] });
      toast('Reply sent');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const tickets = (list.data as any)?.data ?? (Array.isArray(list.data) ? list.data : []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-extrabold text-neutral-900">Support requests</h1>
      {list.isLoading ? (
        <Skeleton className="py-10" />
      ) : list.isError ? (
        <ErrorState title="Failed to load" action={{ label: 'Retry', onClick: () => void list.refetch() }} />
      ) : tickets.length === 0 ? (
        <Card className="p-6 text-center text-sm text-neutral-500">No support requests yet.</Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neutral-900">{t.ticket_number}</p>
                  <p className="text-xs text-neutral-500">{t.subject}</p>
                  <p className="text-xs text-neutral-500">
                    {t.meta?.module ?? t.ticket_type} · {STATUS_LABEL[t.status] ?? t.status}
                  </p>
                  <p className="text-xs text-neutral-400">Updated: {t.updated_at ? formatDateTime(t.updated_at) : '—'}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedId(t.id)}>
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">Ticket details</h2>
              <button onClick={() => setSelectedId(null)} className="text-neutral-400">✕</button>
            </div>
            {detail.isLoading ? (
              <Skeleton className="py-10" />
            ) : detail.isError ? (
              <ErrorState title="Failed to load" action={{ label: 'Retry', onClick: () => void detail.refetch() }} />
            ) : (
              <div className="space-y-3">
                {(() => {
                  const t = detail.data as any;
                  const meta = t?.meta ?? {};
                  const attachments = Array.isArray(t?.attachments) ? t.attachments : [];
                  const messages = Array.isArray(t?.messages) ? t.messages : [];
                  return (
                    <>
                      <div className="text-sm">
                        <p><span className="text-neutral-500">Ticket:</span> {t?.ticket_number}</p>
                        <p><span className="text-neutral-500">Status:</span> {STATUS_LABEL[t?.status] ?? t?.status}</p>
                        <p><span className="text-neutral-500">Module:</span> {meta?.module ?? t?.ticket_type}</p>
                        <p><span className="text-neutral-500">Issue:</span> {meta?.issue_category ?? 'Not provided'}</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{t?.description ?? messages?.[0]?.message}</p>
                      {meta?.resolution_summary && (
                        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                          {meta.resolution_summary}
                        </div>
                      )}
                      {attachments.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Evidence</p>
                          <div className="grid grid-cols-3 gap-2">
                            {attachments.map((att: any) => (
                              <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                                <img src={att.url} alt={att.original_name} className="h-20 w-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Conversation</p>
                        {messages.map((m: any) => (
                          <div key={m.id} className={`rounded-lg p-2 text-sm ${m.is_from_customer ? 'bg-neutral-100' : 'bg-blue-50'}`}>
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            <p className="text-xs text-neutral-400 mt-1">{m.created_at ? formatDateTime(m.created_at) : ''}</p>
                          </div>
                        ))}
                      </div>
                      {!['closed', 'resolved', 'rejected'].includes(t?.status) && (
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Reply or provide requested info"
                          />
                          <Button
                            size="sm"
                            onClick={() => replyMut.mutate({ message: reply })}
                            disabled={replyMut.isPending || !reply.trim()}
                          >
                            Send
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
