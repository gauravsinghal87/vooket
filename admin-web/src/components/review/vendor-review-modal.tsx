import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { vendorsApi, settingsApi } from '@/repositories/admin';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { RejectModal } from '@/components/review/reject-modal';
import { formatDateTime, formatNumber } from '@/lib/utils';
import type { AdminVendorDetail } from '@/typings/models';

interface VendorReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: number;
  onApprove: (commissionRate?: number) => void;
  onReject: (reason: string) => void;
  onSuspend: () => void;
  busy?: boolean;
}

const docTypeLabel: Record<string, string> = {
  gst: 'GST certificate',
  pan: 'PAN card',
  fssai: 'FSSAI licence',
  licence: 'Trade licence',
  bank: 'Bank proof',
  address_proof: 'Address proof',
  logo: 'Logo',
  cover: 'Cover image',
};

function mask(value?: string | null): string {
  if (!value) return '—';
  const v = value.replace(/\s+/g, '');
  if (v.length <= 4) return v;
  return `${'•'.repeat(v.length - 4)}${v.slice(-4)}`;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value ?? '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</h3>
      <dl className="grid gap-4 rounded-xl border border-ink-100 bg-ink-50/40 p-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

const typeLabel: Record<string, string> = { restaurant: 'Restaurant', grocery: 'Grocery store' };

export function VendorReviewModal({ open, onOpenChange, id, onApprove, onReject, onSuspend, busy }: VendorReviewModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [commission, setCommission] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<AdminVendorDetail>({
    queryKey: ['admin-vendor-review', id],
    queryFn: () => vendorsApi.get(id),
    enabled: open && !!id,
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['admin-app-settings-commission'],
    queryFn: () => settingsApi.list('commission'),
    enabled: open,
  });

  const detail = data;
  const statusKey = (detail?.status ?? '').toLowerCase().replace(/\s+/g, '_');
  const outlets = [...(detail?.restaurants ?? []), ...(detail?.stores ?? [])];
  const documents = detail?.vendorDocuments ?? [];
  const reviewable = ['pending', 'rejected', 'suspended', 'approved'].includes(statusKey);

  const globalFoodCommission = commissionSettings?.data?.find((s) => s.key === 'food_commission')?.value;
  const isFood = detail?.vendor_type === 'restaurant';
  const commissionEditable = isFood && (statusKey === 'pending' || statusKey === 'rejected');

  useEffect(() => {
    if (!detail || !isFood) return;
    const initial = statusKey === 'pending' || statusKey === 'rejected'
      ? globalFoodCommission ?? String(detail.commission_rate ?? '')
      : String(detail.commission_rate ?? '');
    setCommission(initial);
  }, [detail?.id, statusKey, isFood, globalFoodCommission, detail?.commission_rate]);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Vendor review"
        description={detail?.business_name ?? 'Vendor'}
        wide
      >
        {isLoading || !detail ? (
          <Skeleton className="p-10" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {detail.logo ? (
                <img src={detail.logo} alt={detail.business_name} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700">
                  {detail.business_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-neutral-900">{detail.business_name}</p>
                <p className="text-sm capitalize text-neutral-500">{typeLabel[detail.vendor_type] ?? detail.vendor_type}</p>
                <p className="text-xs text-neutral-400">
                  {detail.owner_name ?? '—'} · {detail.phone ?? '—'} · #{detail.id}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <StatusBadge status={statusKey} />
                <StatusBadge status={detail.is_active ? 'active' : 'inactive'} />
              </div>
            </div>

            {(statusKey === 'rejected' || statusKey === 'suspended') && detail.rejection_reason && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Reason</p>
                <p className="text-sm text-red-800">{detail.rejection_reason}</p>
              </div>
            )}

            {commissionEditable && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <label htmlFor="vendor-commission" className="mb-1.5 block text-sm font-semibold text-neutral-800">
                  Food Commission %
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    id="vendor-commission"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    max={100}
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    className="w-40"
                  />
                  <p className="text-xs text-neutral-500">Portion of each delivered Food order deducted as commission (0–100).</p>
                </div>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <Section title="Application">
                <Field label="Applied" value={formatDateTime(detail.created_at)} />
                <Field label="Approved" value={formatDateTime(detail.approved_at)} />
                <Field label="Commission" value={`${detail.commission_rate}%`} />
                <Field label="Address" value={detail.address} />
              </Section>

              <Section title="Contact">
                <Field label="Owner" value={detail.owner_name} />
                <Field label="Email" value={detail.email} />
                <Field label="Phone" value={detail.phone} />
                <Field
                  label="Location"
                  value={detail.latitude && detail.longitude ? `${detail.latitude}, ${detail.longitude}` : '—'}
                />
              </Section>

              <Section title="Registration & KYC">
                <Field label="GST" value={detail.gst_number} />
                <Field label="PAN" value={detail.pan_number ? mask(detail.pan_number) : detail.pan_number} />
                <Field label="FSSAI" value={detail.fssai_number} />
                <Field label="Products" value={formatNumber(detail.products_count ?? 0)} />
                <Field label="Orders" value={formatNumber(detail.orders_count ?? 0)} />
              </Section>

              <Section title="Payout bank">
                <Field label="Account holder" value={detail.bank_account_name} />
                <Field label="Bank" value={detail.bank_name} />
                <Field label="Account number" value={mask(detail.bank_account_number)} />
                <Field label="IFSC" value={detail.bank_ifsc} />
              </Section>

              {outlets.length > 0 && (
                <Section title={`Outlets (${outlets.length})`}>
                  {outlets.map((o) => (
                    <Field key={o.id} label="name" value={<span className="capitalize">{o.name}</span>} />
                  ))}
                </Section>
              )}
            </div>

            {documents.length > 0 && (
              <Section title={`Documents (${documents.length})`}>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-900">{docTypeLabel[doc.type] ?? doc.type}</p>
                      <p className="truncate text-xs text-neutral-400">{doc.filename}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={doc.status} />
                      <a
                        href={`/storage/${doc.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-ink-50"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4">
              {reviewable ? (
                <>
                  <Button variant="success" size="sm" disabled={busy || (commissionEditable && commission === '')} onClick={() => onApprove(commissionEditable ? Number(commission) : undefined)}>
                    {statusKey === 'suspended'
                      ? 'Reactivate'
                      : statusKey === 'rejected'
                        ? 'Approve anyway'
                        : statusKey === 'approved'
                          ? 'Re-approve'
                          : 'Approve'}
                  </Button>
                  {(statusKey === 'pending' || statusKey === 'approved' || statusKey === 'suspended') && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
                      Reject
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={busy} onClick={onSuspend}>
                    Suspend
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" disabled={busy} onClick={onSuspend}>
                  Suspend
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <RejectModal
        open={rejecting}
        onOpenChange={setRejecting}
        subject="vendor"
        busy={busy}
        onSubmit={(reason) => {
          onReject(reason);
          setRejecting(false);
        }}
      />
    </>
  );
}