import { useState } from 'react';
import { LogIn, TriangleAlert } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ImpersonateVendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: number | null;
  businessName: string;
  vendorType: string;
  vendorStatus: string;
  onSubmit: (reason: string | undefined) => void;
  busy?: boolean;
}

const typeLabel: Record<string, string> = { restaurant: 'Food', grocery: 'Grocery' };

/**
 * Confirms before opening a vendor panel as the selected vendor.
 *
 * The admin's own admin-panel session is untouched: the backend issues a
 * separate, short-lived vendor session, so closing the vendor tab returns the
 * administrator to a still-authenticated admin panel.
 */
export function ImpersonateVendorModal({
  open,
  onOpenChange,
  vendorId,
  businessName,
  vendorType,
  vendorStatus,
  onSubmit,
  busy,
}: ImpersonateVendorModalProps) {
  const [reason, setReason] = useState('');

  const notApproved = vendorStatus && !['approved', 'active'].includes(vendorStatus.toLowerCase());

  const close = () => {
    setReason('');
    onOpenChange(false);
  };

  const confirm = () => {
    onSubmit(reason.trim() || undefined);
    setReason('');
  };

  return (
    <Modal open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Login as vendor">
      <p className="text-sm text-neutral-600">
        Open the vendor panel as <span className="font-semibold text-neutral-900">{businessName}</span>?
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-neutral-600">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>
          Your Admin session stays active and you can return to Admin afterwards. This access is recorded in the audit
          log.
        </p>
      </div>

      {notApproved && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This vendor is currently <span className="font-semibold">{vendorStatus}</span>. The vendor panel will show the
          application status screen, as the vendor themselves would see it.
        </p>
      )}

      <div className="mt-3 text-xs text-neutral-500">
        Business type: <span className="font-medium text-neutral-700">{typeLabel[vendorType] ?? vendorType}</span>
      </div>

      <label className="mt-4 block text-xs font-medium text-neutral-600" htmlFor="impersonate-reason">
        Reason (optional, recorded in the audit log)
      </label>
      <Textarea
        id="impersonate-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Investigating a settlement complaint raised by the vendor."
        rows={3}
        maxLength={500}
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={busy}
          onClick={confirm}
          disabled={vendorId === null}
        >
          <LogIn className="h-4 w-4" /> Login as vendor
        </Button>
      </div>
    </Modal>
  );
}
