'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

interface Client {
  id: string;
  name: string;
  currency: string;
  _count?: { assignments: number };
}

interface Assignment {
  id: string;
  role?: string | null;
  status: string;
  employee: { firstName: string; lastName: string; employeeCode: string };
}

interface Props {
  preselectedClientId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceModal({ preselectedClientId, onClose, onSuccess }: Props) {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ data: Client[] }>('/clients?isActive=true&limit=200');
        setClients(res.data);
      } catch (err) {
        console.error('Failed to load clients:', err);
      }
    })();
  }, []);

  // Load the selected client's active assignments (employees) to pick from.
  useEffect(() => {
    setAssignmentIds([]);
    setAssignments([]);
    if (!clientId) return;
    setLoadingAssignments(true);
    (async () => {
      try {
        const res = await apiFetch<{ data: Assignment[] }>(
          `/assignments?clientId=${clientId}&status=ACTIVE&limit=100`,
        );
        const active = res.data.filter((a) => a.status === 'ACTIVE');
        setAssignments(active);
        if (active.length === 1) setAssignmentIds([active[0].id]); // single employee → auto-select
      } catch (err) {
        console.error('Failed to load assignments:', err);
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, [clientId]);

  const toggleAssignment = (id: string) => {
    setAssignmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const allSelected = assignments.length > 0 && assignmentIds.length === assignments.length;
  const toggleAll = () => {
    setAssignmentIds(allSelected ? [] : assignments.map((a) => a.id));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ id: string }>('/invoices/generate-for-assignment', {
        method: 'POST',
        body: JSON.stringify({
          assignmentIds,
          notes: notes.trim() || undefined,
        }),
      });
      onSuccess();
      router.push(`/invoices/${result.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate invoice');
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
          maxWidth: '560px', width: '100%', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Generate Invoice
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Bill one or more employees on a single advance invoice — upcoming month, due on receipt.
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency}) — {c._count?.assignments ?? 0} active
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Employees * {assignmentIds.length > 0 && (
                      <span className="text-gray-400 font-normal">({assignmentIds.length} selected)</span>
                    )}
                  </label>
                  {clientId && assignments.length > 1 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="border border-gray-300 rounded-lg max-h-56 overflow-y-auto bg-white">
                  {!clientId ? (
                    <div className="px-3 py-4 text-sm text-gray-400">Select a client first…</div>
                  ) : loadingAssignments ? (
                    <div className="px-3 py-4 text-sm text-gray-400">Loading employees…</div>
                  ) : assignments.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-400">No active employees for this client</div>
                  ) : (
                    assignments.map((a) => {
                      const checked = assignmentIds.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignment(a.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-800">
                            {a.employee.firstName} {a.employee.lastName}
                            {a.role ? ` — ${a.role}` : ''}{' '}
                            <span className="text-gray-400">({a.employee.employeeCode})</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {assignmentIds.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {assignmentIds.length} employees will be billed on one combined invoice (a line item each).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for this invoice..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
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
              disabled={submitting || assignmentIds.length === 0}
              style={{
                padding: '8px 16px', fontSize: '14px', fontWeight: 500,
                color: '#fff', backgroundColor: (submitting || assignmentIds.length === 0) ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: '8px',
                cursor: (submitting || assignmentIds.length === 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
