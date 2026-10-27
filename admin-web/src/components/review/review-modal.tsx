import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { settingsApi } from '@/repositories/admin';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status';
import { Button } from '@/components/ui/button';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { RejectModal } from '@/components/review/reject-modal';
import { formatDateTime, formatNumber } from '@/lib/utils';
import type { AdminDeliveryPartnerDetail, AdminDriverDetail } from '@/typings/models';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'driver' | 'delivery_partner';
  id: number;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSuspend: () => void;
  busy?: boolean;
}

const docTypeLabel: Record<string, string> = {
  license: 'Driving licence',
  insurance: 'Insurance',
  rc: 'Registration (RC)',
  permit: 'Permit',
  fitness: 'Fitness',
  pollution: 'Pollution / PUC',
  aadhar: 'Aadhaar',
  profile_photo: 'Profile photo',
  registration: 'Registration (RC)',
};

function mask(value?: string | null): string {
  if (!value) return '—';
  const v = value.replace(/\s+/g, '');
  if (v.length <= 4) return v;
  return `${'•'.repeat(v.length - 4)}${v.slice(-4)}`;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

export function ReviewModal({ open, onOpenChange, kind, id, onApprove, onReject, onSuspend, busy }: ReviewModalProps) {
  const [rejecting, setRejecting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<AdminDriverDetail | AdminDeliveryPartnerDetail>({
    queryKey: ['admin-review', kind, id],
    queryFn: (): Promise<AdminDriverDetail | AdminDeliveryPartnerDetail> =>
      kind === 'driver' ? settingsApi.driver(id) : settingsApi.deliveryPartner(id),
    enabled: open && !!id,
  });

  const detail = data as AdminDriverDetail | AdminDeliveryPartnerDetail | undefined;
  const statusKey = (detail?.status ?? '').toLowerCase().replace(/\s+/g, '_');
  const name = detail?.user?.name ?? '—';
  const documents = detail?.documents ?? [];
  const reviewable = ['pending', 'rejected', 'suspended', 'approved'].includes(statusKey);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={kind === 'driver' ? 'Rider review' : 'Delivery partner review'}
        description={name}
        wide
      >
        {isLoading || !detail ? (
          <Skeleton className="p-10" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-neutral-900">{name}</p>
                <p className="text-sm text-neutral-500">{detail.user?.email ?? '—'}</p>
                <p className="text-xs text-neutral-400">
                  {(detail.user?.country_code ?? '+91')} {detail.user?.phone ?? '—'} · #{detail.id}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <StatusBadge status={statusKey} />
                {kind === 'driver' && (
                  <StatusBadge status={(detail as AdminDriverDetail).is_verified ? 'verified' : 'unverified'} />
                )}
              </div>
            </div>

            {(statusKey === 'rejected' || statusKey === 'suspended') && detail.rejection_reason && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Reason</p>
                <p className="text-sm text-red-800">{detail.rejection_reason}</p>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <Section title="Application">
                <Field label="Applied" value={formatDateTime(detail.created_at)} />
                <Field label="Reviewed" value={formatDateTime(detail.reviewed_at)} />
                <Field label="Last location" value={detail.latitude ? `${detail.latitude}, ${detail.longitude}` : '—'} />
              </Section>

              <Section title="Vehicle">
                <Field
                  label="Type"
                  value={
                    kind === 'driver'
                      ? (detail as AdminDriverDetail).vehicle_type?.name
                      : (detail as AdminDeliveryPartnerDetail).vehicle_type
                  }
                />
                {kind === 'delivery_partner' && (
                  <Field
                    label="Service"
                    value={
                      (detail as AdminDeliveryPartnerDetail).service_type === 'grocery'
                        ? 'Grocery delivery'
                        : (detail as AdminDeliveryPartnerDetail).service_type === 'food'
                          ? 'Food delivery'
                          : '—'
                    }
                  />
                )}
                <Field label="Number" value={detail.vehicle_number} />
                <Field label="Model" value={detail.vehicle_model} />
                <Field label="Colour" value={detail.vehicle_color} />
              </Section>

              <Section title="Licence & KYC">
                <Field label="Licence number" value={detail.license_number} />
                <Field label="Licence expiry" value={formatDateOnly(detail.license_expiry)} />
                <Field label="Aadhaar" value={detail.aadhar_number} />
                {kind === 'driver' && <Field label="PAN" value={(detail as AdminDriverDetail).pan_number} />}
              </Section>

              <Section title="Payout bank">
                <Field label="Account holder" value={detail.bank_account_name} />
                <Field label="Bank" value={detail.bank_name} />
                <Field label="Account number" value={mask(detail.bank_account_number)} />
                <Field label="IFSC" value={detail.bank_ifsc} />
              </Section>

              <Section title="Performance">
                <Field
                  label="Rating"
                  value={detail.rating ? `${Number(detail.rating).toFixed(1)} (${detail.rating_count ?? 0})` : '—'}
                />
                <Field
                  label={kind === 'driver' ? 'Trips' : 'Deliveries'}
                  value={
                    kind === 'driver'
                      ? formatNumber((detail as AdminDriverDetail).total_trips ?? 0)
                      : formatNumber((detail as AdminDeliveryPartnerDetail).total_deliveries ?? 0)
                  }
                />
                {kind === 'delivery_partner' && (
                  <Field label="Total earnings" value={(detail as AdminDeliveryPartnerDetail).total_earnings ?? '—'} />
                )}
              </Section>
            </div>

            {documents.length > 0 && (
              <Section title={`Documents (${documents.length})`}>
                {documents.map((doc, i) => (
                  <div key={doc.id ?? i} className="flex items-center justify-between gap-2">
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
                  <Button variant="success" size="sm" disabled={busy} onClick={onApprove}>
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
        subject={kind === 'driver' ? 'rider' : 'delivery partner'}
        busy={busy}
        onSubmit={(reason) => {
          onReject(reason);
          setRejecting(false);
        }}
      />
    </>
  );
}