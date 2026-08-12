'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import {
  Button, Badge, Modal, PageSkeleton, PageHeader, DataTable, useToast, Select,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { LogOut, Plus, Trash2, Download, Calculator } from 'lucide-react';

interface ExitRow {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  exitType: string;
  lastWorkingDay: string;
  status: string;
  netSettlement: string | null;
  settledAt: string | null;
}
interface Emp { id: string; firstName: string; lastName: string; employeeCode: string; status: string; }
interface Adjustment { label: string; amount: number; }
interface Fnf {
  employee: string; code: string; lastWorkingDay: string; ctcMonthly: number;
  pendingSalaryDays: number; daysInMonth: number; pendingSalaryAmount: number; adjustments: Adjustment[]; netSettlement: number;
}

const money = (n: any) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));

export default function ExitPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitiate, setShowInitiate] = useState(false);
  const [settleFor, setSettleFor] = useState<ExitRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiFetch<ExitRow[]>('/exit'));
    } catch (e: any) {
      toast('error', e?.message || 'Failed to load exits');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function cancel(r: ExitRow) {
    if (!confirm(`Cancel the exit for ${r.employeeName}? This reactivates the employee.`)) return;
    try {
      await apiFetch(`/exit/${r.employeeId}/cancel`, { method: 'POST' });
      toast('success', 'Exit cancelled');
      load();
    } catch (e: any) {
      toast('error', e?.message || 'Failed');
    }
  }

  const columns: Column<ExitRow>[] = [
    { key: 'employeeName', header: 'Employee', render: (r) => (
      <div><p className="font-medium text-content-primary">{r.employeeName}</p>
        <p className="text-xs text-content-tertiary">{r.employeeCode}</p></div>
    ) },
    { key: 'exitType', header: 'Type', render: (r) => <span className="text-content-secondary capitalize">{r.exitType.toLowerCase()}</span> },
    { key: 'lastWorkingDay', header: 'Last Working Day', render: (r) => <span className="text-content-secondary">{String(r.lastWorkingDay).slice(0, 10)}</span> },
    { key: 'netSettlement', header: 'Net Settlement', render: (r) => <span className="text-content-secondary">{r.netSettlement != null ? money(r.netSettlement) : '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <Badge variant={r.status === 'SETTLED' ? 'success' : r.status === 'CANCELLED' ? 'default' : 'warning'}>{r.status}</Badge>
    ) },
    { key: 'id', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        {r.status === 'INITIATED' && (
          <>
            <Button variant="ghost" size="xs" icon={<Calculator size={14} />} onClick={() => setSettleFor(r)}>F&amp;F</Button>
            <Button variant="ghost" size="xs" icon={<Trash2 size={14} />} onClick={() => cancel(r)}>Cancel</Button>
          </>
        )}
        {r.status === 'SETTLED' && (
          <a href={`${API_BASE}/exit/${r.employeeId}/settlement-pdf`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="xs" icon={<Download size={14} />}>Statement</Button>
          </a>
        )}
      </div>
    ) },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Exit / Full & Final"
        description="Offboard employees and settle their full-and-final."
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowInitiate(true)}>Initiate Exit</Button>}
      />
      {loading ? <PageSkeleton /> : (
        <DataTable columns={columns} data={rows} emptyMessage="No exits yet." />
      )}
      {showInitiate && (
        <InitiateModal onClose={() => setShowInitiate(false)} onDone={() => { setShowInitiate(false); load(); }} />
      )}
      {settleFor && (
        <SettleModal row={settleFor} onClose={() => setSettleFor(null)} onDone={() => { setSettleFor(null); load(); }} />
      )}
    </DashboardLayout>
  );
}

function InitiateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [form, setForm] = useState({ employeeId: '', lastWorkingDay: '', resignationDate: '', reason: '', exitType: 'RESIGNATION' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Emp[] }>('/employees?limit=500')
      .then((r) => setEmps((r.data || []).filter((e) => e.status === 'ACTIVE')))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!form.employeeId || !form.lastWorkingDay) { toast('error', 'Employee and last working day are required'); return; }
    setSaving(true);
    try {
      await apiFetch('/exit/initiate', { method: 'POST', body: JSON.stringify(form) });
      toast('success', 'Exit initiated');
      onDone();
    } catch (e: any) {
      toast('error', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Initiate Exit">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-content-secondary">Employee</label>
          <Select
            value={form.employeeId}
            onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            options={[{ value: '', label: 'Select…' }, ...emps.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-content-secondary">Exit Type</label>
            <Select value={form.exitType} onChange={(e) => setForm((f) => ({ ...f, exitType: e.target.value }))}
              options={[{ value: 'RESIGNATION', label: 'Resignation' }, { value: 'TERMINATION', label: 'Termination' }]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-content-secondary">Last Working Day</label>
            <input type="date" value={form.lastWorkingDay} onChange={(e) => setForm((f) => ({ ...f, lastWorkingDay: e.target.value }))}
              className="w-full rounded-lg border border-border-primary px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-content-secondary">Reason (optional)</label>
          <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className="w-full rounded-lg border border-border-primary px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Initiate'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function SettleModal({ row, onClose, onDone }: { row: ExitRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [fnf, setFnf] = useState<Fnf | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [notes, setNotes] = useState('');
  const [settling, setSettling] = useState(false);

  const preview = useCallback(async (adj: Adjustment[]) => {
    try {
      const clean = adj.filter((a) => a.label.trim());
      setFnf(await apiFetch<Fnf>(`/exit/${row.employeeId}/preview-fnf`, { method: 'POST', body: JSON.stringify({ adjustments: clean }) }));
    } catch (e: any) {
      toast('error', e?.message || 'Preview failed');
    }
  }, [row.employeeId, toast]);

  useEffect(() => { preview([]); }, [preview]);

  function updateAdj(next: Adjustment[]) {
    setAdjustments(next);
    preview(next);
  }

  async function settle() {
    if (!confirm(`Settle F&F and TERMINATE ${row.employeeName}? This cannot be undone.`)) return;
    setSettling(true);
    try {
      await apiFetch(`/exit/${row.employeeId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ adjustments: adjustments.filter((a) => a.label.trim()), notes }),
      });
      toast('success', 'Full & final settled');
      onDone();
    } catch (e: any) {
      toast('error', e?.message || 'Failed');
    } finally {
      setSettling(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Full & Final — ${row.employeeName}`} size="lg">
      <div className="space-y-4">
        {fnf && (
          <div className="rounded-lg border border-border-primary p-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-content-secondary">Pending salary ({fnf.pendingSalaryDays} of {fnf.daysInMonth} day(s) @ {money(fnf.ctcMonthly)}/mo)</span>
              <span className="font-medium">{money(fnf.pendingSalaryAmount)}</span>
            </div>
            {adjustments.filter((a) => a.label.trim()).map((a, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-content-secondary">{a.label}</span>
                <span className={a.amount < 0 ? 'text-danger' : ''}>{a.amount < 0 ? '−' : '+'}{money(Math.abs(a.amount))}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-border-primary pt-2 font-semibold">
              <span>Net Settlement</span><span>{money(fnf.netSettlement)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-content-secondary">Adjustments (+ credit, − recovery)</label>
          {adjustments.map((a, i) => (
            <div key={i} className="mb-1.5 flex gap-2">
              <input placeholder="Label (e.g. Leave encashment)" value={a.label}
                onChange={(e) => updateAdj(adjustments.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                className="flex-1 rounded-lg border border-border-primary px-3 py-1.5 text-sm" />
              <input type="number" placeholder="Amount" value={a.amount || ''}
                onChange={(e) => updateAdj(adjustments.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                className="w-32 rounded-lg border border-border-primary px-3 py-1.5 text-sm" />
              <button onClick={() => updateAdj(adjustments.filter((_, j) => j !== i))} className="text-content-tertiary hover:text-danger"><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={() => setAdjustments([...adjustments, { label: '', amount: 0 }])} className="text-xs font-medium text-primary">+ Add line</button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-content-secondary">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-border-primary px-3 py-2 text-sm" />
        </div>

        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Settling terminates the employee and revokes their portal access, and generates the settlement statement PDF.
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={settle} disabled={settling}>{settling ? 'Settling…' : 'Settle & Terminate'}</Button>
        </div>
      </div>
    </Modal>
  );
}
