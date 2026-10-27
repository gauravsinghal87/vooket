import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportTicketsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export function SupportTicketsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const tickets = useQuery({
    queryKey: ['admin-support-tickets', status, search],
    queryFn: () => supportTicketsApi.list({ status: status || undefined, search: search || undefined, per_page: 50 }),
  });

  const detail = useQuery({
    queryKey: ['admin-support-ticket', selectedId],
    queryFn: () => supportTicketsApi.get(selectedId as number),
    enabled: selectedId != null,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => supportTicketsApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void qc.invalidateQueries({ queryKey: ['admin-support-ticket', selectedId] });
      toast('Support ticket updated');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const refund = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => supportTicketsApi.refund(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void qc.invalidateQueries({ queryKey: ['admin-support-ticket', selectedId] });
      toast('Refund processed');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const t = detail.data;
  const order = t?.order;
  const rs = t?.refund_summary;
  const meta = t?.meta ?? {};

  useEffect(() => {
    if ((t?.refund_summary as any)?.suggested_refund_amount != null) {
      setRefundAmount(String((t?.refund_summary as any).suggested_refund_amount));
    }
  }, [t?.refund_summary]);

  useEffect(() => {
    if (selectedId == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedId]);

  const _internalNotes = Array.isArray(meta?.internal_notes) ? meta.internal_notes : [];
  void _internalNotes;

  const amountNum = Number(refundAmount);
  const remainingNum = Number(rs?.remaining_refundable_amount ?? 0);
  const amountInvalid =
    !refundAmount.trim() ||
    !Number.isFinite(amountNum) ||
    amountNum <= 0 ||
    amountNum > remainingNum + 1e-9 ||
    rs?.can_approve_refund === false;
  void (meta as any);

  return (
    <>
      <PageHeader title="Support tickets" description="Review customer support and refund requests" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search ticket / customer / order" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs" />
        <select className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="pending">Pending</option>
          <option value="waiting_for_customer">Waiting for customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {tickets.isLoading ? (
        <Skeleton className="py-10" />
      ) : tickets.isError ? (
        <ErrorState onRetry={() => void tickets.refetch()} />
      ) : (
        <div className="space-y-3">
          {(tickets.data?.data ?? []).map((tk: any) => (
              <Card key={tk.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900">{tk.ticket_number}</p>
                    <p className="text-xs text-neutral-500">{tk.user?.name} · {tk.subject}</p>
                    <p className="text-xs text-neutral-500">Module: {tk.meta?.module || tk.ticket_type} · Priority: {tk.priority} · Status: {tk.status}</p>
                    <p className="text-xs text-neutral-400">Created: {tk.created_at ? formatDateTime(tk.created_at) : '—'} · Updated: {tk.updated_at ? formatDateTime(tk.updated_at) : '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedId(tk.id); setInternalNote(''); setReplyText(''); setRefundAmount(''); setRefundReason(''); }}>
                      Review
                    </Button>
                  </div>
                </div>
              </Card>
          ))}
          {(tickets.data?.data ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-ink-200 p-10 text-center text-sm text-neutral-400">
              No support tickets found.
            </div>
          )}
        </div>
      )}

      {selectedId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-details-title"
            className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            style={{ width: 'min(1100px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 id="ticket-details-title" className="text-base font-bold text-neutral-900">Ticket details</h2>
                <p className="text-xs text-neutral-500">{t?.ticket_number ?? ''} · {t?.status ?? ''}</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {detail.isLoading ? (
                <Skeleton className="py-10" />
              ) : detail.isError ? (
                <ErrorState onRetry={() => void detail.refetch()} />
              ) : (
                <div className="space-y-5">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Ticket information</h3>
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div><span className="text-neutral-500">Ticket:</span> {t?.ticket_number}</div>
                      <div><span className="text-neutral-500">Status:</span> {t?.status}</div>
                      <div><span className="text-neutral-500">Type:</span> {t?.ticket_type}</div>
                      <div><span className="text-neutral-500">Module:</span> {(t?.meta as any)?.module ?? t?.ticket_type}</div>
                      <div><span className="text-neutral-500">Priority:</span> {t?.priority}</div>
                      <div><span className="text-neutral-500">Issue:</span> {(t?.meta as any)?.issue_category ?? 'Not provided'}</div>
                      <div><span className="text-neutral-500">Created:</span> {t?.created_at ? formatDateTime(t.created_at) : 'Not provided'}</div>
                      <div><span className="text-neutral-500">Updated:</span> {t?.updated_at ? formatDateTime(t.updated_at) : 'Not provided'}</div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm"><span className="text-neutral-500">Customer:</span> {t?.user?.name ?? 'Not provided'} (ID: {t?.user?.id ?? 'Not provided'})</p>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{t?.description ?? t?.messages?.[0]?.message ?? 'Not provided'}</p>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium">Requested resolution</p>
                      <p className="text-sm">Destination: {(t?.meta as any)?.refund_destination ?? 'Not provided'}</p>
                      <p className="text-sm">Amount: {(t?.meta as any)?.requested_refund_amount != null ? formatCurrency((t?.meta as any).requested_refund_amount) : 'Not provided'}</p>
                    </div>
                  </section>

                  {Array.isArray((t as any)?.attachments) && (t as any).attachments.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-900">Customer evidence</h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {(t as any).attachments.map((att: any) => (
                          <a
                            key={att.id}
                            href={att.url || att.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-neutral-200"
                            title={att.original_name}
                          >
                            <img
                              src={att.url || att.download_url}
                              alt={att.original_name || 'Evidence'}
                              className="h-24 w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <p className="truncate px-2 py-1 text-xs text-neutral-500">{att.original_name}</p>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Linked order</h3>
                    {order ? (
                      <div className="space-y-1 text-sm">
                        <p className="break-words">{order.order_number} · {order.status}</p>
                        <p className="break-words">{order.restaurant?.name ?? order.store?.name ?? 'Not provided'}</p>
                        <p>Subtotal: {formatCurrency(order.subtotal)} · Delivery: {formatCurrency(order.delivery_fee)} · Discount: {formatCurrency(order.discount_amount)} · Total: {formatCurrency(order.total_amount)}</p>
                        <p>Payment: {order.payment_method} · {order.payment_status}</p>
                        <p>Created: {order.created_at ? formatDateTime(order.created_at) : 'Not provided'}</p>
                        {(order.items ?? []).length > 0 && (
                          <ul className="list-disc pl-5">
                            {order.items.map((it: any) => (
                              <li key={it.id} className="break-words">{it.product_name} × {it.quantity} — {formatCurrency(it.line_total)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">Linked order not available.</p>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Financial review</h3>
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div><span className="text-neutral-500">Payment amount:</span> {t?.financial_review?.transaction_summary?.payment_amount != null ? formatCurrency(t.financial_review.transaction_summary.payment_amount) : (t?.financial_review?.payment_amount != null ? formatCurrency(t.financial_review.payment_amount) : 'Not provided')}</div>
                      <div><span className="text-neutral-500">Previously refunded:</span> {t?.financial_review?.refund_summary?.previously_refunded != null ? formatCurrency(t.financial_review.refund_summary.previously_refunded) : (t?.financial_review?.previously_refunded != null ? formatCurrency(t.financial_review.previously_refunded) : 'Not provided')}</div>
                      <div><span className="text-neutral-500">Subtotal:</span> {t?.financial_review?.transaction_summary?.subtotal != null ? formatCurrency(t.financial_review.transaction_summary.subtotal) : 'Not provided'}</div>
                      <div><span className="text-neutral-500">Total:</span> {t?.financial_review?.transaction_summary?.total_amount != null ? formatCurrency(t.financial_review.transaction_summary.total_amount) : 'Not provided'}</div>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{t?.financial_review?.note}</p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Refund review</h3>
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <div><span className="text-neutral-500">Original paid:</span> {rs?.original_paid_amount != null ? formatCurrency(rs.original_paid_amount) : 'Not provided'}</div>
                      <div><span className="text-neutral-500">Previously refunded:</span> {rs?.previously_refunded_amount != null ? formatCurrency(rs.previously_refunded_amount) : 'Not provided'}</div>
                      <div><span className="text-neutral-500">Remaining refundable:</span> {rs?.remaining_refundable_amount != null ? formatCurrency(rs.remaining_refundable_amount) : 'Not provided'}</div>
                      <div><span className="text-neutral-500">Suggested amount:</span> {rs?.suggested_refund_amount != null ? formatCurrency(rs.suggested_refund_amount) : 'Not provided'}</div>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Max refundable: {rs?.remaining_refundable_amount != null ? formatCurrency(rs.remaining_refundable_amount) : 'Not provided'}</p>
                    <p className="text-xs text-neutral-500">Delivery-partner earnings are never reversed.</p>

                    {remainingNum <= 0 ? (
                      <p className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">No refundable amount remaining.</p>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Input
                          placeholder="Refund amount"
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          className="sm:w-40"
                        />
                        <Input
                          placeholder="Admin reason (required)"
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          className="sm:flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => refund.mutate({ id: selectedId as number, body: { amount: Number(refundAmount), reason: refundReason, destination: (t?.meta as any)?.refund_destination ?? 'wallet' } })}
                          disabled={refund.isPending || amountInvalid || !refundReason.trim()}
                        >
                          {refund.isPending ? 'Processing…' : 'Approve refund'}
                        </Button>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Internal notes (staff only)</h3>
                    <div className="space-y-2">
                      {(Array.isArray((t?.meta as any)?.internal_notes) ? (t?.meta as any).internal_notes : []).map((n: any, idx: number) => (
                        <div key={idx} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <p className="whitespace-pre-wrap break-words">{n.note}</p>
                          <p className="mt-1 text-xs text-amber-700">{n.added_at ? formatDateTime(n.added_at) : ''}</p>
                        </div>
                      ))}
                      {(Array.isArray((t?.meta as any)?.internal_notes) ? (t?.meta as any).internal_notes : []).length === 0 && (
                        <p className="text-sm text-neutral-500">No internal notes.</p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-900">Admin actions</h3>
                    <p className="mb-2 text-sm text-neutral-500 whitespace-pre-wrap break-words">{(t?.meta as any)?.admin_notes ?? 'Not provided'}</p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Input placeholder="Add internal note (staff only)" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="sm:flex-1" />
                            <Button size="sm" onClick={() => { update.mutate({ id: selectedId as number, body: { internal_note: internalNote } }); setInternalNote(''); }} disabled={update.isPending || !internalNote.trim()}>
                              Add internal note
                            </Button>
                            <Input placeholder="Send customer reply" value={replyText} onChange={(e) => setReplyText(e.target.value)} className="sm:flex-1" />
                            <Button size="sm" variant="secondary" onClick={() => { update.mutate({ id: selectedId as number, body: { reply: replyText } }); setReplyText(''); }} disabled={update.isPending || !replyText.trim()}>
                              Send reply
                            </Button>
                          </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
