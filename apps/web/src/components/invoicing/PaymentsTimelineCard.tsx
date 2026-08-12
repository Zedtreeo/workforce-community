// apps/web/src/components/invoicing/PaymentsTimelineCard.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Badge } from '../../components/ui';
import { CreditCard, Plus, Trash2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { WriteOffDialog } from './WriteOffDialog';

interface Payment {
  id: string;
  paidOn: string;
  amount: string;
  currency: string;
  exchangeRate?: string | null;
  amountInInvoiceCurrency: string;
  method: string;
  reference?: string | null;
  bankFee?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Summary {
  total: string;
  paid: string;
  writtenOff: string;
  outstanding: string;
  bankFees: string;
  paymentCount: number;
}

interface Props {
  invoiceId: string;
  invoiceCurrency: string;
  invoiceTotal: number;
  invoiceStatus: string;
  canWrite: boolean;
  onUpdated?: () => void;
}

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  PAYONEER: 'Payoneer',
  WIRE: 'Wire',
  CREDIT_CARD: 'Credit Card',
  CHECK: 'Check',
  CASH: 'Cash',
  OTHER: 'Other',
};

export function PaymentsTimelineCard({
  invoiceId, invoiceCurrency, invoiceTotal, invoiceStatus, canWrite, onUpdated,
}: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ payments: Payment[]; summary: Summary }>(`/invoices/${invoiceId}/payments`);
      setPayments(res.payments);
      setSummary(res.summary);
    } finally { setLoading(false); }
  }, [invoiceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Remove this payment? This will recompute the invoice outstanding.')) return;
    await apiFetch(`/invoices/${invoiceId}/payments/${paymentId}`, { method: 'DELETE' });
    fetchData(); onUpdated?.();
  };

  const outstanding = summary ? Number(summary.outstanding) : 0;
  const isClosed = invoiceStatus === 'CANCELLED' || invoiceStatus === 'VOID';

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-content-primary flex items-center gap-2">
            <CreditCard size={16} /> Payments
          </h3>
          <p className="text-xs text-content-tertiary">
            {summary?.paymentCount ?? 0} payment{summary?.paymentCount === 1 ? '' : 's'} recorded
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && !isClosed && outstanding > 0.01 && (
            <Button variant="secondary" size="sm" onClick={() => setWriteOffOpen(true)} className="whitespace-nowrap">
              Write off
            </Button>
          )}
          {canWrite && !isClosed && (
            <Button onClick={() => setRecordOpen(true)} size="sm" className="gap-1.5 whitespace-nowrap">
              <Plus size={14} /> Record payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <SummaryTile label="Invoice total"  value={summary.total}      ccy={invoiceCurrency} />
          <SummaryTile label="Paid"           value={summary.paid}        ccy={invoiceCurrency} variant="success" />
          {Number(summary.writtenOff) > 0 && (
            <SummaryTile label="Written off" value={summary.writtenOff}  ccy={invoiceCurrency} variant="warning" />
          )}
          <SummaryTile
            label="Outstanding"
            value={summary.outstanding}
            ccy={invoiceCurrency}
            variant={outstanding <= 0.01 ? 'success' : 'danger'}
          />
        </div>
      )}
      {summary && Number(summary.bankFees) > 0 && (
        <p className="text-xs text-content-tertiary mb-3">
          Bank/Payoneer fees absorbed: {summary.bankFees} (in payment currencies)
        </p>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="text-sm text-content-tertiary text-center py-6">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-content-tertiary text-center py-8">
          <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
          No payments recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-content-tertiary border-b border-surface-100">
            <tr>
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Method</th>
              <th className="text-right py-2">Paid ({payments[0]?.currency})</th>
              <th className="text-right py-2">FX</th>
              <th className="text-right py-2">In {invoiceCurrency}</th>
              <th className="text-right py-2">Bank Fee</th>
              <th className="text-left py-2 pl-3">Reference</th>
              <th className="text-right py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-surface-100 last:border-0">
                <td className="py-2">{new Date(p.paidOn).toLocaleDateString()}</td>
                <td className="py-2"><Badge variant="default">{METHOD_LABEL[p.method] || p.method}</Badge></td>
                <td className="py-2 text-right tabular-nums">{Number(p.amount).toFixed(2)} {p.currency}</td>
                <td className="py-2 text-right tabular-nums text-content-tertiary">
                  {p.exchangeRate ? Number(p.exchangeRate).toFixed(4) : '—'}
                </td>
                <td className="py-2 text-right tabular-nums font-medium">{Number(p.amountInInvoiceCurrency).toFixed(2)}</td>
                <td className="py-2 text-right tabular-nums text-content-tertiary">
                  {p.bankFee ? Number(p.bankFee).toFixed(2) : '—'}
                </td>
                <td className="py-2 pl-3 text-xs text-content-tertiary">{p.reference ?? '—'}</td>
                <td className="py-2 text-right">
                  {canWrite && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 rounded hover:bg-danger/10 text-content-tertiary hover:text-danger"
                      title="Remove payment"
                    ><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {recordOpen && (
        <RecordPaymentDialog
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          invoiceId={invoiceId}
          invoiceCurrency={invoiceCurrency}
          outstanding={outstanding}
          onSaved={() => { fetchData(); onUpdated?.(); }}
        />
      )}
      {writeOffOpen && (
        <WriteOffDialog
          open={writeOffOpen}
          onClose={() => setWriteOffOpen(false)}
          invoiceId={invoiceId}
          invoiceCurrency={invoiceCurrency}
          outstanding={outstanding}
          onSaved={() => { fetchData(); onUpdated?.(); }}
        />
      )}
    </Card>
  );
}

function SummaryTile({ label, value, ccy, variant = 'default' }: { label: string; value: string; ccy: string; variant?: 'default'|'success'|'danger'|'warning' }) {
  const color = variant === 'success' ? 'text-success' : variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : 'text-content-primary';
  const bg    = variant === 'success' ? 'bg-success/5 border-success/20' : variant === 'danger' ? 'bg-danger/5 border-danger/20' : variant === 'warning' ? 'bg-warning/5 border-warning/20' : 'bg-surface-50 border-surface-200';
  return (
    <div className={`rounded-lg border ${bg} px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wide text-content-tertiary">{label}</div>
      <div className={`text-base font-semibold tabular-nums whitespace-nowrap ${color}`}>
        {ccy} {Number(value).toFixed(2)}
      </div>
    </div>
  );
}
