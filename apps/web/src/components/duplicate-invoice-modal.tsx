'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

interface Props {
  invoice: {
    id: string;
    invoiceNumber: string;
    currency: string;
    total: string | number;
    client?: { name: string } | null;
    lineCount?: number;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const PERIOD_OPTIONS: { value: 'next' | 'this' | 'same'; label: string; hint: string }[] = [
  { value: 'next', label: 'Next month', hint: 'Advance the billing period forward by one month' },
  { value: 'this', label: 'This month', hint: 'Shift the period to the invoice-date month' },
  { value: 'same', label: 'Same as original', hint: 'Copy the original period exactly (a true copy)' },
];

export function DuplicateInvoiceModal({ invoice, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [periodMonth, setPeriodMonth] = useState<'next' | 'this' | 'same'>('next');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ id: string }>(`/invoices/${invoice.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ invoiceDate, periodMonth }),
      });
      onSuccess?.();
      router.push(`/invoices/${result.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to duplicate invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff', borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          maxWidth: '480px', width: '100%', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Duplicate Invoice
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Creates a new DRAFT with the next invoice number.
              </p>
            </div>
            <button onClick={onClose} style={{ fontSize: '20px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {/* Summary of what's being cloned */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Cloning</span>
                <span className="font-mono font-medium text-gray-800">{invoice.invoiceNumber}</span>
              </div>
              {invoice.client?.name && (
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Client</span>
                  <span className="text-gray-800">{invoice.client.name}</span>
                </div>
              )}
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Total{invoice.lineCount ? ` · ${invoice.lineCount} line${invoice.lineCount > 1 ? 's' : ''}` : ''}</span>
                <span className="font-mono text-gray-800">
                  {invoice.currency} {Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice date *</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Billing period</label>
                <div className="flex flex-col gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${periodMonth === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input
                        type="radio"
                        name="periodMonth"
                        checked={periodMonth === opt.value}
                        onChange={() => setPeriodMonth(opt.value)}
                        className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="font-medium text-gray-800">{opt.label}</span>
                        <span className="block text-xs text-gray-500">{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: '12px',
              padding: '16px 24px', borderTop: '1px solid #e5e7eb',
              flexShrink: 0, backgroundColor: '#fff', borderRadius: '0 0 12px 12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', fontSize: '14px', fontWeight: 500,
                color: '#374151', backgroundColor: '#fff',
                border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 16px', fontSize: '14px', fontWeight: 500,
                color: '#fff', backgroundColor: submitting ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: '8px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
