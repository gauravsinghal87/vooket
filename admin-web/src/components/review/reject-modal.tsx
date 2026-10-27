import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface RejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  onSubmit: (reason: string) => void;
  busy?: boolean;
}

export function RejectModal({ open, onOpenChange, subject, onSubmit, busy }: RejectModalProps) {
  const [reason, setReason] = useState('');

  const confirm = () => {
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setReason('');
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title="Reject application"
      description={`Send a reason to the ${subject} so they can fix and resubmit.`}
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Licence expiry date looks incorrect, please check and resubmit."
        rows={4}
        autoFocus
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" disabled={!reason.trim() || busy} onClick={confirm}>
          {busy ? 'Rejecting…' : 'Reject application'}
        </Button>
      </div>
    </Modal>
  );
}