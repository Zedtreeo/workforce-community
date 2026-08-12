'use client';

import { useEffect, useState, FormEvent } from 'react';
import { apiFetch } from '../lib/api';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  status: string;
}

interface Props {
  clientId?: string;
  clientName?: string;
  employeeId?: string;
  employeeName?: string;
  defaultCurrency?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const BILLING_CYCLES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'FIXED', label: 'Fixed' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'AED', 'SAR', 'SGD', 'INR'];

const WORK_SCHEDULES = [
  { value: 'FULL_TIME', label: 'Full-Time' },
  { value: 'PART_TIME', label: 'Part-Time' },
];

export function AssignmentModal({
  clientId,
  clientName,
  employeeId,
  employeeName,
  defaultCurrency = 'USD',
  onClose,
  onSuccess,
}: Props) {
  const fixedMode: 'client' | 'employee' = clientId ? 'client' : 'employee';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; currency: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId ?? '');
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? '');

  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [billingRate, setBillingRate] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [workSchedule, setWorkSchedule] = useState('FULL_TIME');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (fixedMode === 'client') {
          const res = await apiFetch<{ data: Employee[] }>(
            `/employees?status=ACTIVE&limit=200`,
          );
          setEmployees(res.data);
        } else {
          const res = await apiFetch<{ data: any[] }>(`/clients?isActive=true&limit=200`);
          setClients(res.data.map((c) => ({ id: c.id, name: c.name, currency: c.currency })));
        }
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    })();
  }, [fixedMode]);

  useEffect(() => {
    if (fixedMode === 'employee' && selectedClientId) {
      const c = clients.find((x) => x.id === selectedClientId);
      if (c) setCurrency(c.currency);
    }
  }, [selectedClientId, clients, fixedMode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        employeeId: selectedEmployeeId,
        clientId: selectedClientId,
        role: role.trim() || undefined,
        startDate,
        endDate: endDate || undefined,
        billingRate,
        currency,
        billingCycle,
        workSchedule,
        notes: notes.trim() || undefined,
      };
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          maxWidth: '640px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                {fixedMode === 'client' ? `Assign Employee to ${clientName}` : `Assign ${employeeName} to Client`}
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Employee can only have one active client at a time.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ fontSize: '20px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {fixedMode === 'client' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Employee *</label>
                  <select
                    required
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} — {emp.employeeCode}
                        {emp.designation ? ` (${emp.designation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
                  <select
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role at Client</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Engagement Type *</label>
                  <select
                    required
                    value={workSchedule}
                    onChange={(e) => setWorkSchedule(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {WORK_SCHEDULES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Billing Rate *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={billingRate}
                    onChange={(e) => setBillingRate(e.target.value)}
                    placeholder="3500.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    required
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cycle *</label>
                  <select
                    required
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {BILLING_CYCLES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal note about this engagement..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky footer — always visible */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              flexShrink: 0,
              backgroundColor: '#fff',
              borderRadius: '0 0 12px 12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: submitting ? '#93c5fd' : '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
