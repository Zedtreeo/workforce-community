'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Modal, PageSkeleton } from '../../../components/ui';

interface SalaryStructure {
  id: string;
  employeeId: string;
  employee: { firstName: string; lastName: string; employeeCode: string; designation: string | null };
  effectiveFrom: string;
  basic: string; hra: string; da: string; specialAllow: string; otherAllow: string;
  grossSalary: string;
  pfEmployee: string; pfEmployer: string; esiEmployee: string; esiEmployer: string;
  profTax: string; tds: string;
  netSalary: string; ctc: string;
  isActive: boolean;
}

interface Employee { id: string; firstName: string; lastName: string; employeeCode: string }

export default function SalaryStructuresPage() {
  const { data: session } = useSession();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    employeeId: '', effectiveFrom: new Date().toISOString().split('T')[0],
    basic: '', hra: '', da: '', specialAllow: '', otherAllow: '',
  });

  const load = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const [s, e] = await Promise.all([
        apiFetch<SalaryStructure[]>('/payroll/salary-structures', { token: session.session.token }),
        apiFetch<{ data: Employee[] }>('/employees?limit=500', { token: session.session.token }),
      ]);
      setStructures(s);
      setEmployees(e.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session?.session?.token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!session?.session?.token || !form.employeeId || !form.basic) return;
    setCreating(true);
    try {
      await apiFetch('/payroll/salary-structures', {
        method: 'POST',
        token: session.session.token,
        body: JSON.stringify({
          employeeId: form.employeeId,
          effectiveFrom: form.effectiveFrom,
          basic: +form.basic,
          ...(form.hra && { hra: +form.hra }),
          ...(form.da && { da: +form.da }),
          ...(form.specialAllow && { specialAllow: +form.specialAllow }),
          ...(form.otherAllow && { otherAllow: +form.otherAllow }),
        }),
      });
      setShowCreate(false);
      setForm({ employeeId: '', effectiveFrom: new Date().toISOString().split('T')[0], basic: '', hra: '', da: '', specialAllow: '', otherAllow: '' });
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (v: string | number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/payroll" className="text-sm text-content-tertiary hover:text-content-secondary">&larr; Payroll</Link>
          <h1 className="text-2xl font-bold text-content-primary">Salary Structures</h1>
          <Button className="ml-auto" onClick={() => setShowCreate(true)}>+ Add Structure</Button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : structures.length === 0 ? (
          <Card className="p-8 text-center text-content-tertiary">
            No salary structures yet. Add one to start running payroll.
          </Card>
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-content-secondary">Employee</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Basic</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">HRA</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Gross</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">PF</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">ESI</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Net</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">CTC (Annual)</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {structures.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-content-primary">{s.employee.firstName} {s.employee.lastName}</p>
                      <p className="text-xs text-content-tertiary">{s.employee.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3">{fmt(s.basic)}</td>
                    <td className="px-4 py-3">{fmt(s.hra)}</td>
                    <td className="px-4 py-3 font-medium">{fmt(s.grossSalary)}</td>
                    <td className="px-4 py-3 text-xs">{fmt(s.pfEmployee)}<br/><span className="text-content-tertiary">+{fmt(s.pfEmployer)} ER</span></td>
                    <td className="px-4 py-3 text-xs">{fmt(s.esiEmployee)}<br/><span className="text-content-tertiary">+{fmt(s.esiEmployer)} ER</span></td>
                    <td className="px-4 py-3 font-semibold text-success-dark">{fmt(s.netSalary)}</td>
                    <td className="px-4 py-3 font-medium text-brand-700">{fmt(s.ctc)}</td>
                    <td className="px-4 py-3 text-xs text-content-tertiary">{new Date(s.effectiveFrom).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Salary Structure"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={create} loading={creating} disabled={!form.employeeId || !form.basic}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <select
            className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            <option value="">Select Employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
            ))}
          </select>
          <input type="date" className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <p className="text-xs text-content-tertiary font-medium mt-1">Monthly Earnings</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Basic *" className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.basic}
              onChange={(e) => setForm({ ...form, basic: e.target.value })} />
            <input placeholder="HRA (auto 40%)" className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.hra}
              onChange={(e) => setForm({ ...form, hra: e.target.value })} />
            <input placeholder="DA" className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.da}
              onChange={(e) => setForm({ ...form, da: e.target.value })} />
            <input placeholder="Special Allow." className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.specialAllow}
              onChange={(e) => setForm({ ...form, specialAllow: e.target.value })} />
            <input placeholder="Other Allow." className="border border-surface-300 rounded-lg px-3 py-2 text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" value={form.otherAllow}
              onChange={(e) => setForm({ ...form, otherAllow: e.target.value })} />
          </div>
          <p className="text-xs text-content-tertiary">PF, ESI, Prof Tax, TDS auto-calculated from basic/gross. Override in API if needed.</p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
