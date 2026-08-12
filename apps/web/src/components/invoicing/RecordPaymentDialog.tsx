// apps/web/src/components/invoicing/RecordPaymentDialog.tsx
'use client';

import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button, FormField, Input, Select } from '../../components/ui';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'PAYONEER',      label: 'Payoneer' },
  { value: 'WIRE',          label: 'Wire' },
  { value: 'CREDIT_CARD',   label: 'Credit Card' },
  { value: 'CHECK',         label: 'Check' },
  { value: 'CASH',          label: 'Cash' },
  { value: 'OTHER',         label: 'Other' },
];

export function RecordPaymentDialog({
  open, onClose, invoiceId, invoiceCurrency, outstanding, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceCurrency: string;
  outstanding: number;
  onSaved?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [paidOn, setPaidOn] = useState(today);
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : '');
  const [currency, setCurrency] = useState(invoiceCurrency);
  const [exchangeRate, setExchangeRate] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [bankFee, setBankFee] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDifferentCcy = currency.toUpperCase() !== invoiceCurrency.toUpperCase();
  const effectiveRate = isDifferentCcy ? (parseFloat(exchangeRate) || 0) : 1;
  const amountInInvoiceCcy = (parseFloat(amount) || 0) * effectiveRate;

  const handleSubmit = async () => {
    setError(null);
    if (isDifferentCcy && !exchangeRate) {
      setError(`Exchange rate required when payment currency (${currency}) differs from invoice currency (${invoiceCurrency})`);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paidOn,
          amount: parseFloat(amount),
          currency: currency.toUpperCase(),
          exchangeRate: isDifferentCcy ? parseFloat(exchangeRate) : undefined,
          method,
          reference: reference || undefined,
          bankFee: bankFee ? parseFloat(bankFee) : undefined,
          notes: notes || undefined,
        }),
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Record payment"
      description={`Outstanding: ${invoiceCurrency} ${outstanding.toFixed(2)}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={busy} disabled={busy || !amount}>Save payment</Button>
        </>
      }
    >
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Paid on" required>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </FormField>
        <FormField label="Method" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} />
        </FormField>
        <FormField label="Amount" required>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Currency" required>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </FormField>
        {isDifferentCcy && (
          <>
            <FormField label={`Exchange rate (1 ${currency} = ? ${invoiceCurrency})`} required>
              <Input type="number" step="0.000001" min="0.000001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
            </FormField>
            <div className="flex items-end">
              <div className="w-full p-2 rounded-lg bg-surface-50 text-sm">
                <span className="text-content-tertiary">In {invoiceCurrency}: </span>
                <span className="font-semibold tabular-nums">{amountInInvoiceCcy.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
        <FormField label="Bank/Payoneer fee (optional)">
          <Input type="number" step="0.01" min="0" value={bankFee} onChange={(e) => setBankFee(e.target.value)} placeholder="Receiver-side fee" />
        </FormField>
        <FormField label="Reference (optional)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank txn / Payoneer ID / cheque #" />
        </FormField>
        <div className="col-span-2">
          <FormField label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
