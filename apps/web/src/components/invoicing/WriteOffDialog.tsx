// apps/web/src/components/invoicing/WriteOffDialog.tsx
'use client';

import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button, FormField, Input } from '../../components/ui';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export function WriteOffDialog({
  open, onClose, invoiceId, invoiceCurrency, outstanding, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceCurrency: string;
  outstanding: number;
  onSaved?: () => void;
}) {
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (reason.trim().length < 5) { setError('Reason must be at least 5 characters'); return; }
    setBusy(true);
    try {
      await apiFetch(`/invoices/${invoiceId}/write-off`, {
        method: 'PATCH',
        body: JSON.stringify({ amount: parseFloat(amount), reason: reason.trim() }),
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to write off');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Write off shortfall"
      description={`Outstanding: ${invoiceCurrency} ${outstanding.toFixed(2)}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={busy} disabled={busy}>Confirm write-off</Button>
        </>
      }
    >
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <p className="text-xs text-content-tertiary mb-3">
        Use this when the client paid less than the invoiced amount and you accept the shortfall
        (common for FX / bank-fee differences). Written-off amount is recorded permanently with reason.
        Admin only.
      </p>
      <div className="space-y-3">
        <FormField label={`Amount to write off (${invoiceCurrency})`} required>
          <Input type="number" step="0.01" min="0" max={outstanding.toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Reason" required error={reason && reason.length < 5 ? 'Min 5 chars' : undefined}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bank fee absorbed, FX rounding" maxLength={500} />
        </FormField>
      </div>
    </Modal>
  );
}
