'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, PageSkeleton } from '../../../components/ui';
import { Pencil } from 'lucide-react';

interface Balance {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  leaveType: { name: string; code: string; isPaid: boolean };
  year: number;
  entitled: number;
  used: number;
  carriedOver: number;
  adjustment: number;
  available: number;
}

export default function LeaveBalancesPage() {
  const { data: session } = useSession();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [initializing, setInitializing] = useState(false);
  const [accruing, setAccruing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const fetchBalances = useCallback(async () => {
    if (!session?.session?.id) return;
    setLoading(true);
    try {
      const data = await apiFetch<Balance[]>(`/leaves/balances?year=${year}`);
      setBalances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, year]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const handleInit = async () => {
    if (!confirm(`Initialize leave balances for all active employees for ${year}? This will create balance entries based on your leave type defaults.`)) return;
    setInitializing(true);
    try {
      const result = await apiFetch<{ created: number; skipped: number; employeesProcessed: number }>('/leaves/balances/init', {
        method: 'POST',
        body: JSON.stringify({ year }),
      });
      alert(`Done! ${result.created} balance entries created, ${result.skipped} already existed. (${result.employeesProcessed} employees processed)`);
      fetchBalances();
    } catch (err: any) {
      alert(err.message || 'Failed to initialize');
    } finally {
      setInitializing(false);
    }
  };

  const handleAccrue = async () => {
    if (!confirm('Run leave accrual now? Each active employee earns Earned Leave for every completed month since their join date (full-time 9h = 1.0/month, part-time 4.5h = 0.5/month). This is safe to run repeatedly — already-credited months are never double-counted.')) return;
    setAccruing(true);
    try {
      const result = await apiFetch<{ employeesProcessed: number; leavesCredited: number }>('/leaves/accrue', { method: 'POST' });
      alert(`Accrual complete. ${result.leavesCredited} leave(s) credited across ${result.employeesProcessed} employees.`);
      fetchBalances();
    } catch (err: any) {
      alert(err.message || 'Failed to run accrual');
    } finally {
      setAccruing(false);
    }
  };

  const startEdit = (b: Balance) => { setEditId(b.id); setEditVal(String(b.adjustment)); };
  const saveAdjust = async (b: Balance) => {
    const val = parseFloat(editVal);
    if (Number.isNaN(val)) { alert('Enter a valid number'); return; }
    try {
      await apiFetch(`/leaves/balances/${b.id}/adjust`, { method: 'PATCH', body: JSON.stringify({ adjustment: val }) });
      setEditId(null);
      fetchBalances();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust');
    }
  };

  // Tidy numeric display (supports 0.5 increments, avoids float noise)
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : `${+(+n).toFixed(2)}`);

  // Group balances by employee
  const grouped = balances.reduce<Record<string, { employee: Balance['employee']; types: Balance[] }>>((acc, b) => {
    if (!acc[b.employee.id]) {
      acc[b.employee.id] = { employee: b.employee, types: [] };
    }
    acc[b.employee.id].types.push(b);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/leaves" className="text-sm text-content-tertiary hover:text-content-secondary">← Back to Leaves</Link>
            <div>
              <h1 className="text-2xl font-bold text-content-primary">Leave Balances</h1>
              <p className="text-sm text-content-tertiary mt-0.5">View and manage employee leave balances</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleAccrue} loading={accruing}>
              {accruing ? 'Running…' : 'Run Accrual'}
            </Button>
            <Button onClick={handleInit} loading={initializing}>
              {initializing ? 'Initializing...' : 'Initialize Balances'}
            </Button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-content-tertiary mb-2">No balances found for {year}</p>
            <p className="text-sm text-content-tertiary">Click &quot;Initialize Balances&quot; to create balance entries for all active employees</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(grouped).map(({ employee, types }) => (
              <Card key={employee.id} padding="none" className="overflow-hidden">
                <div className="px-5 py-3 bg-surface-50 border-b border-surface-200">
                  <span className="font-medium text-content-primary">{employee.firstName} {employee.lastName}</span>
                  <span className="text-xs text-content-tertiary ml-2">{employee.employeeCode}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="text-left px-5 py-2.5 font-medium text-content-tertiary text-xs">Leave Type</th>
                      <th className="text-center px-5 py-2.5 font-medium text-content-tertiary text-xs">Entitled</th>
                      <th className="text-center px-5 py-2.5 font-medium text-content-tertiary text-xs">Carried Over</th>
                      <th className="text-center px-5 py-2.5 font-medium text-content-tertiary text-xs">Adjustment</th>
                      <th className="text-center px-5 py-2.5 font-medium text-content-tertiary text-xs">Used</th>
                      <th className="text-center px-5 py-2.5 font-medium text-content-tertiary text-xs">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((b) => (
                      <tr key={b.id} className="border-b border-surface-100">
                        <td className="px-5 py-2.5">
                          <Badge variant="brand">{b.leaveType.code}</Badge>
                          <span className="text-content-secondary ml-2 text-xs">{b.leaveType.name}</span>
                        </td>
                        <td className="px-5 py-2.5 text-center font-medium">{fmt(b.entitled)}</td>
                        <td className="px-5 py-2.5 text-center text-content-tertiary">{fmt(b.carriedOver)}</td>
                        <td className="px-5 py-2.5 text-center text-content-tertiary">
                          {editId === b.id ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                value={editVal}
                                onChange={(e) => setEditVal(e.target.value)}
                                className="w-16 px-1.5 py-1 border border-surface-300 rounded text-center text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                autoFocus
                              />
                              <button onClick={() => saveAdjust(b)} className="text-success-dark hover:underline text-xs">Save</button>
                              <button onClick={() => setEditId(null)} className="text-content-tertiary hover:underline text-xs">Cancel</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => startEdit(b)}
                              title="Add or deduct days (e.g. 2 grants two extra days, -1 deducts one)"
                              className="group inline-flex items-center gap-1.5 px-2 py-1 rounded border border-surface-200 hover:border-brand-400 hover:text-brand-600 transition-colors"
                            >
                              <span className={b.adjustment !== 0 ? 'font-medium text-content-primary' : ''}>
                                {b.adjustment > 0 ? `+${fmt(b.adjustment)}` : fmt(b.adjustment)}
                              </span>
                              <Pencil size={11} className="text-content-tertiary group-hover:text-brand-600" />
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-center text-warning-dark font-medium">{fmt(b.used)}</td>
                        <td className="px-5 py-2.5 text-center">
                          <span className={`font-bold ${b.available > 3 ? 'text-success-dark' : b.available > 0 ? 'text-warning-dark' : 'text-danger-dark'}`}>
                            {fmt(b.available)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
