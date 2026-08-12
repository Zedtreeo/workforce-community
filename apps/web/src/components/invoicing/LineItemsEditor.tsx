// apps/web/src/components/invoicing/LineItemsEditor.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input } from '../../components/ui';
import { Plus, RefreshCw, Trash2, Check, X, AlertCircle, Pencil } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface LineItem {
  id: string;
  description: string;
  quantity: string | number;
  rate: string | number;
  amount: string | number;
  sortOrder: number;
  assignmentId?: string | null;
  assignment?: { employee: { firstName: string; lastName: string; employeeCode: string } } | null;
}

interface Props {
  invoiceId: string;
  invoiceCurrency: string;
  invoiceStatus: string;     // DRAFT only allows edits
  onUpdated?: () => void;    // parent refetches totals
}

export function LineItemsEditor({ invoiceId, invoiceCurrency, invoiceStatus, onUpdated }: Props) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = invoiceStatus === 'DRAFT';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<LineItem[]>(`/invoices/${invoiceId}/line-items`);
      setItems(res);
    } finally { setLoading(false); }
  }, [invoiceId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this line item? Totals will be recomputed.')) return;
    setError(null);
    try {
      await apiFetch(`/invoices/${invoiceId}/line-items/${id}`, { method: 'DELETE' });
      await fetchItems(); onUpdated?.();
    } catch (e: any) { setError(e.message); }
  };

  const handleRegenerate = async () => {
    if (!confirm(
      'Re-derive line items from the assignments active during this billing period.\n\n' +
      '• Assignment-linked items will be REPLACED with fresh data\n' +
      '• Manually-added items will be PRESERVED\n\nContinue?',
    )) return;
    setRegenerating(true); setError(null);
    try {
      const res: any = await apiFetch(`/invoices/${invoiceId}/regenerate-line-items`, { method: 'POST' });
      await fetchItems(); onUpdated?.();
      if (res?._meta) {
        alert(`Regenerated: ${res._meta.linkedAdded} assignment item(s) refreshed, ${res._meta.manualPreserved} manual item(s) preserved.`);
      }
    } catch (e: any) { setError(e.message); }
    finally { setRegenerating(false); }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
        <h3 className="font-semibold text-content-primary">Line Items</h3>
        {isDraft && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleRegenerate} loading={regenerating} className="gap-1.5">
              <RefreshCw size={14} /> Regenerate from assignments
            </Button>
            <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5" disabled={adding}>
              <Plus size={14} /> Add line item
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-2 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-xs text-content-tertiary bg-surface-50">
          <tr>
            <th className="text-left py-2 pl-4 w-10">#</th>
            <th className="text-left py-2 min-w-[220px]">Description</th>
            <th className="text-right py-2 w-20">Qty</th>
            <th className="text-right py-2 w-32">Rate</th>
            <th className="text-right py-2 w-32 pr-4">Amount</th>
            {isDraft && <th className="w-20"></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="text-center py-6 text-content-tertiary">Loading…</td></tr>
          ) : items.length === 0 && !adding ? (
            <tr><td colSpan={6} className="text-center py-8 text-content-tertiary">No line items yet.</td></tr>
          ) : (
            items.map((item, idx) => (
              editingId === item.id
                ? <EditRow key={item.id} item={item} idx={idx} onCancel={() => setEditingId(null)}
                    onSaved={async () => { setEditingId(null); await fetchItems(); onUpdated?.(); }}
                    invoiceId={invoiceId} setError={setError} />
                : <DisplayRow key={item.id} item={item} idx={idx} currency={invoiceCurrency} isDraft={isDraft}
                    onEdit={() => setEditingId(item.id)} onDelete={() => handleDelete(item.id)} />
            ))
          )}
          {adding && (
            <AddRow
              invoiceId={invoiceId}
              onSaved={async () => { setAdding(false); await fetchItems(); onUpdated?.(); }}
              onCancel={() => setAdding(false)}
              setError={setError}
            />
          )}
        </tbody>
      </table>
      </div>

      {!isDraft && (
        <div className="px-4 py-2 text-xs text-content-tertiary bg-warning/5 border-t border-warning/20">
          Invoice is <strong>{invoiceStatus}</strong> — line items locked. Cancel and regenerate to make changes.
        </div>
      )}
    </Card>
  );
}

// ────────── Display row ──────────
function DisplayRow({
  item, idx, currency, isDraft, onEdit, onDelete,
}: {
  item: LineItem; idx: number; currency: string; isDraft: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const amt = Number(item.amount);
  const isNegative = amt < 0;
  return (
    <tr className="border-t border-surface-100 hover:bg-surface-50/50">
      <td className="py-2 pl-4 text-content-tertiary">{idx + 1}</td>
      <td className="py-2">
        <div className="flex flex-col">
          <span>{item.description}</span>
          {!item.assignmentId && (
            <span className="text-[10px] text-content-tertiary">manual entry</span>
          )}
        </div>
      </td>
      <td className="py-2 text-right tabular-nums">{Number(item.quantity).toFixed(2)}</td>
      <td className={`py-2 text-right tabular-nums ${isNegative ? 'text-danger' : ''}`}>{Number(item.rate).toFixed(2)}</td>
      <td className={`py-2 text-right tabular-nums font-medium pr-4 whitespace-nowrap ${isNegative ? 'text-danger' : ''}`}>
        {isNegative ? '−' : ''}{currency} {Math.abs(amt).toFixed(2)}
      </td>
      {isDraft && (
        <td className="py-2 pr-4 text-right">
          <button onClick={onEdit} title="Edit"
            className="p-1 rounded hover:bg-brand-50 text-content-secondary hover:text-brand-600 mr-1">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} title="Remove"
            className="p-1 rounded hover:bg-danger/10 text-content-tertiary hover:text-danger">
            <Trash2 size={13} />
          </button>
        </td>
      )}
    </tr>
  );
}

// ────────── Edit row ──────────
function EditRow({
  item, idx, onSaved, onCancel, invoiceId, setError,
}: {
  item: LineItem; idx: number; onSaved: () => void; onCancel: () => void;
  invoiceId: string; setError: (m: string | null) => void;
}) {
  const [desc, setDesc]   = useState(item.description);
  const [qty,  setQty]    = useState(String(item.quantity));
  const [rate, setRate]   = useState(String(item.rate));
  const [busy, setBusy]   = useState(false);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await apiFetch(`/invoices/${invoiceId}/line-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: desc,
          quantity: parseFloat(qty),
          rate: parseFloat(rate),
        }),
      });
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const amount = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
  return (
    <tr className="border-t border-surface-100 bg-brand-50/20">
      <td className="py-2 pl-4 text-content-tertiary">{idx + 1}</td>
      <td className="py-2 pr-2"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></td>
      <td className="py-2 px-1"><Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="text-right" /></td>
      <td className="py-2 px-1"><Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="text-right" /></td>
      <td className="py-2 text-right tabular-nums pr-4">{amount.toFixed(2)}</td>
      <td className="py-2 pr-4 text-right">
        <button onClick={save} disabled={busy} title="Save"
          className="p-1 rounded hover:bg-success/10 text-success mr-1"><Check size={14} /></button>
        <button onClick={onCancel} title="Cancel"
          className="p-1 rounded hover:bg-surface-100 text-content-tertiary"><X size={14} /></button>
      </td>
    </tr>
  );
}

// ────────── Add row ──────────
function AddRow({
  invoiceId, onSaved, onCancel, setError,
}: {
  invoiceId: string; onSaved: () => void; onCancel: () => void;
  setError: (m: string | null) => void;
}) {
  const [desc, setDesc] = useState('');
  const [qty,  setQty]  = useState('1');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!desc.trim() || !rate) { setError('Description and rate required'); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch(`/invoices/${invoiceId}/line-items`, {
        method: 'POST',
        body: JSON.stringify({
          description: desc.trim(),
          quantity: parseFloat(qty) || 1,
          rate: parseFloat(rate),
        }),
      });
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const amount = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
  return (
    <tr className="border-t border-surface-100 bg-success/5">
      <td className="py-2 pl-4 text-content-tertiary">+</td>
      <td className="py-2 pr-2">
        <Input value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Project setup fee  /  Unpaid-leave deduction  /  Performance bonus" />
      </td>
      <td className="py-2 px-1">
        <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="text-right" />
      </td>
      <td className="py-2 px-1">
        <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
          placeholder="negative = deduct" className="text-right" />
      </td>
      <td className={`py-2 text-right tabular-nums pr-4 font-medium ${amount < 0 ? 'text-danger' : ''}`}>
        {amount.toFixed(2)}
      </td>
      <td className="py-2 pr-4 text-right">
        <button onClick={save} disabled={busy || !desc.trim() || !rate} title="Add"
          className="p-1 rounded hover:bg-success/10 text-success mr-1 disabled:opacity-50"><Check size={14} /></button>
        <button onClick={onCancel} title="Cancel"
          className="p-1 rounded hover:bg-surface-100 text-content-tertiary"><X size={14} /></button>
      </td>
    </tr>
  );
}
