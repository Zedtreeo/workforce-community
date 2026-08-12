'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Modal, Input, PageSkeleton, PageHeader } from '../../components/ui';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import { HolidayCalendar } from '../../components/holiday-calendar';

interface Holiday { id: string; name: string; date: string; isOptional: boolean; year: number }
interface ShiftType { id: string; name: string; code: string; startTime: string; endTime: string; graceMinutes: number; isDefault: boolean; _count: { assignments: number } }
interface ShiftAssignment {
  id: string;
  employee: { firstName: string; lastName: string; employeeCode: string };
  shiftType: { name: string; code: string; startTime: string; endTime: string };
  effectiveFrom: string; effectiveTo: string | null; isActive: boolean;
}
interface Employee { id: string; firstName: string; lastName: string; employeeCode: string }

export default function HolidaysPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<'holidays' | 'shifts' | 'assignments'>('holidays');
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddHol, setShowAddHol] = useState(false);
  const [holForm, setHolForm] = useState({ name: '', date: '', isOptional: false });
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', graceMinutes: 15 });
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: '', shiftTypeId: '', effectiveFrom: new Date().toISOString().split('T')[0] });

  const load = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const [h, s, a, e] = await Promise.all([
        apiFetch<Holiday[]>(`/holidays?year=${year}`, { token: session.session.token }),
        apiFetch<ShiftType[]>('/holidays/shifts', { token: session.session.token }),
        apiFetch<ShiftAssignment[]>('/holidays/shifts/assignments', { token: session.session.token }),
        apiFetch<{ data: Employee[] }>('/employees?limit=500', { token: session.session.token }),
      ]);
      setHolidays(h); setShifts(s); setAssignments(a); setEmployees(e.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session?.session?.token, year]);

  useEffect(() => { load(); }, [load]);

  const addHoliday = async () => {
    if (!session?.session?.token || !holForm.name || !holForm.date) return;
    await apiFetch('/holidays', {
      method: 'POST', token: session.session.token,
      body: JSON.stringify({ ...holForm, year }),
    });
    setShowAddHol(false); setHolForm({ name: '', date: '', isOptional: false }); load();
  };

  const deleteHoliday = async (id: string) => {
    if (!session?.session?.token || !confirm('Remove this holiday?')) return;
    await apiFetch(`/holidays/${id}`, { method: 'DELETE', token: session.session.token });
    load();
  };

  const addShift = async () => {
    if (!session?.session?.token || !shiftForm.name || !shiftForm.code) return;
    await apiFetch('/holidays/shifts', {
      method: 'POST', token: session.session.token,
      body: JSON.stringify(shiftForm),
    });
    setShowAddShift(false); setShiftForm({ name: '', code: '', startTime: '09:00', endTime: '18:00', graceMinutes: 15 }); load();
  };

  const assignShift = async () => {
    if (!session?.session?.token || !assignForm.employeeId || !assignForm.shiftTypeId) return;
    await apiFetch('/holidays/shifts/assign', {
      method: 'POST', token: session.session.token,
      body: JSON.stringify(assignForm),
    });
    setShowAssign(false); setAssignForm({ employeeId: '', shiftTypeId: '', effectiveFrom: new Date().toISOString().split('T')[0] }); load();
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;

  const tabs = [
    { key: 'holidays', label: `Holidays (${holidays.length})` },
    { key: 'shifts', label: `Shift Types (${shifts.length})` },
    { key: 'assignments', label: `Assignments (${assignments.length})` },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Holidays & Shifts"
          description="Manage company holidays and shift schedules"
          breadcrumbs={[{ label: 'Holidays' }]}
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Holidays Tab */}
        {tab === 'holidays' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select className="h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={year} onChange={(e) => setYear(+e.target.value)}>
                {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="ml-auto">
                <Button icon={<Plus size={16} />} onClick={() => setShowAddHol(true)}>Add Holiday</Button>
              </div>
            </div>
            <Card>
              <HolidayCalendar holidays={holidays} year={year} />
            </Card>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Day</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Holiday</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {holidays.map((h) => {
                      const d = new Date(h.date);
                      return (
                        <tr key={h.id} className="hover:bg-surface-50 transition-colors">
                          <td className="px-4 py-3 text-content-secondary">{d.toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-content-tertiary">{dayNames[d.getDay()]}</td>
                          <td className="px-4 py-3 font-medium text-content-primary">{h.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={h.isOptional ? 'warning' : 'success'} dot>
                              {h.isOptional ? 'Optional' : 'Mandatory'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="xs" icon={<Trash2 size={14} />} onClick={() => deleteHoliday(h.id)} className="text-danger hover:text-danger">
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {holidays.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-content-tertiary">No holidays for {year}</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Shifts Tab */}
        {tab === 'shifts' && (
          <div className="space-y-4">
            <Button icon={<Plus size={16} />} onClick={() => setShowAddShift(true)}>Add Shift Type</Button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {shifts.map((s) => (
                <Card key={s.id} hover>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-content-primary">{s.name}</p>
                    <Badge variant="default">{s.code}</Badge>
                  </div>
                  <p className="text-sm text-brand-600 font-medium">{s.startTime} — {s.endTime}</p>
                  <p className="text-xs text-content-tertiary mt-1">Grace: {s.graceMinutes}min &middot; {s._count.assignments} assigned {s.isDefault && '· Default'}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'assignments' && (
          <div className="space-y-4">
            <Button icon={<Plus size={16} />} onClick={() => setShowAssign(true)}>Assign Shift</Button>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Shift</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Timing</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">From</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-content-primary">{a.employee.firstName} {a.employee.lastName}</p>
                          <p className="text-xs text-content-tertiary">{a.employee.employeeCode}</p>
                        </td>
                        <td className="px-4 py-3 text-content-secondary">{a.shiftType.name} ({a.shiftType.code})</td>
                        <td className="px-4 py-3 text-brand-600 font-medium">{a.shiftType.startTime} — {a.shiftType.endTime}</td>
                        <td className="px-4 py-3 text-xs text-content-tertiary">{new Date(a.effectiveFrom).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant={a.isActive ? 'success' : 'default'} dot>
                            {a.isActive ? 'Active' : 'Ended'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {assignments.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-content-tertiary">No shift assignments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Add Holiday Modal */}
      <Modal open={showAddHol} onClose={() => setShowAddHol(false)} title={`Add Holiday — ${year}`}
        footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setShowAddHol(false)}>Cancel</Button><Button onClick={addHoliday}>Add</Button></div>}>
        <div className="space-y-4">
          <Input label="Holiday Name" placeholder="e.g., Independence Day" value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Date</label>
            <input type="date" className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={holForm.date} onChange={(e) => setHolForm({ ...holForm, date: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input type="checkbox" checked={holForm.isOptional} onChange={(e) => setHolForm({ ...holForm, isOptional: e.target.checked })} className="rounded border-surface-300" />
            Optional (restricted)
          </label>
        </div>
      </Modal>

      {/* Add Shift Modal */}
      <Modal open={showAddShift} onClose={() => setShowAddShift(false)} title="New Shift Type"
        footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setShowAddShift(false)}>Cancel</Button><Button onClick={addShift}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g., Day Shift" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
          <Input label="Code" placeholder="e.g., DAY" value={shiftForm.code} onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">Start</label>
              <input type="time" className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">End</label>
              <input type="time" className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Assign Shift Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Shift"
        footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setShowAssign(false)}>Cancel</Button><Button onClick={assignShift}>Assign</Button></div>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Employee</label>
            <select className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}>
              <option value="">Select Employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Shift</label>
            <select className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={assignForm.shiftTypeId} onChange={(e) => setAssignForm({ ...assignForm, shiftTypeId: e.target.value })}>
              <option value="">Select Shift</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Effective From</label>
            <input type="date" className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={assignForm.effectiveFrom} onChange={(e) => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })} />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
