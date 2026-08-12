'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton, EmptyState, PageHeader } from '../../components/ui';
import { Clock, Plus, Pencil, Trash2, Users, UserPlus } from 'lucide-react';

interface ShiftType {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  totalHours: string;
  workingHours: string;
  lunchBreakMinutes: number;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  _count: { assignments: number };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  designation: string | null;
}

const defaultForm = {
  name: '', code: '', startTime: '09:00', endTime: '18:00',
  graceMinutes: 15, lunchBreakMinutes: 60, totalHours: 9,
  description: '', isDefault: false,
};

export default function ShiftsPage() {
  const { data: session } = useSession();
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignShiftId, setAssignShiftId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailShift, setDetailShift] = useState<any>(null);

  const token = session?.session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ShiftType[]>('/shifts', { token });
      setShifts(data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(defaultForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (s: ShiftType) => {
    setEditId(s.id);
    setForm({
      name: s.name, code: s.code, startTime: s.startTime, endTime: s.endTime,
      graceMinutes: s.graceMinutes, lunchBreakMinutes: s.lunchBreakMinutes,
      totalHours: Number(s.totalHours), description: s.description || '', isDefault: s.isDefault,
    });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await apiFetch(`/shifts/${editId}`, { method: 'PATCH', token, body: JSON.stringify(form) });
      } else {
        await apiFetch('/shifts', { method: 'POST', token, body: JSON.stringify(form) });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!token || !confirm('Delete this shift type?')) return;
    try {
      await apiFetch(`/shifts/${id}`, { method: 'DELETE', token });
      load();
    } catch (e: any) {
      alert(e.message || 'Cannot delete');
    }
  };

  const openAssign = async (shiftId: string) => {
    if (!token) return;
    setAssignShiftId(shiftId);
    setSelectedEmployees([]);
    try {
      const emps = await apiFetch<Employee[]>('/employees', { token });
      setEmployees(Array.isArray(emps) ? emps : (emps as any).data || []);
    } catch { /* */ }
    setShowAssign(true);
  };

  const doAssign = async () => {
    if (!token || selectedEmployees.length === 0) return;
    setAssigning(true);
    try {
      if (selectedEmployees.length === 1) {
        await apiFetch('/shifts/assign', {
          method: 'POST', token,
          body: JSON.stringify({ shiftTypeId: assignShiftId, employeeId: selectedEmployees[0], effectiveFrom: new Date().toISOString().split('T')[0] }),
        });
      } else {
        await apiFetch('/shifts/assign/bulk', {
          method: 'POST', token,
          body: JSON.stringify({ shiftTypeId: assignShiftId, employeeIds: selectedEmployees, effectiveFrom: new Date().toISOString().split('T')[0] }),
        });
      }
      setShowAssign(false);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed');
    } finally {
      setAssigning(false);
    }
  };

  const viewDetail = async (id: string) => {
    if (!token) return;
    try {
      const data = await apiFetch(`/shifts/${id}`, { token });
      setDetailShift(data);
      setShowDetail(true);
    } catch { /* */ }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Shift Management"
          breadcrumbs={[{ label: 'Shifts' }]}
          actions={
            <Button variant="primary" size="sm" icon={<Plus />} onClick={openCreate}>
              Create Shift
            </Button>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : shifts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Clock />}
              title="No shift types defined"
              description="Create shift types (e.g. Day Shift, Night Shift) and assign to employees."
              action={{ label: 'Create Shift', onClick: openCreate }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <Card key={s.id} className="relative">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-content-primary">{s.name}</h3>
                      <p className="text-xs text-content-tertiary font-mono">{s.code}</p>
                    </div>
                    <div className="flex gap-1">
                      {s.isDefault && <Badge variant="brand">Default</Badge>}
                      <Badge variant={s.isActive ? 'success' : 'default'} dot>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-xs text-content-tertiary">Timing</p>
                      <p className="text-sm font-medium text-content-primary">{s.startTime} – {s.endTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-tertiary">Working Hours</p>
                      <p className="text-sm font-medium text-content-primary">{Number(s.workingHours)}h (+ {s.lunchBreakMinutes}m lunch)</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-tertiary">Grace Period</p>
                      <p className="text-sm font-medium text-content-primary">{s.graceMinutes} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-tertiary">Assigned</p>
                      <p className="text-sm font-medium text-content-primary">{s._count.assignments} employee{s._count.assignments === 1 ? '' : 's'}</p>
                    </div>
                  </div>

                  {s.description && <p className="text-xs text-content-tertiary mb-3">{s.description}</p>}

                  <div className="flex gap-2 border-t border-surface-100 pt-3">
                    <Button variant="ghost" size="xs" icon={<Users />} onClick={() => viewDetail(s.id)}>
                      View
                    </Button>
                    <Button variant="ghost" size="xs" icon={<UserPlus />} onClick={() => openAssign(s.id)}>
                      Assign
                    </Button>
                    <Button variant="ghost" size="xs" icon={<Pencil />} onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="xs" icon={<Trash2 />} onClick={() => remove(s.id)} className="text-danger hover:text-danger-dark">
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Edit Shift Type' : 'Create Shift Type'}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={save}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Shift Name *</label>
              <input className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day Shift" />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Code *</label>
              <input className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DAY" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Start Time</label>
              <input type="time" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">End Time</label>
              <input type="time" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Total Hours</label>
              <input type="number" step="0.5" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.totalHours} onChange={(e) => setForm({ ...form, totalHours: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Lunch (mins)</label>
              <input type="number" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.lunchBreakMinutes} onChange={(e) => setForm({ ...form, lunchBreakMinutes: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Grace (mins)</label>
              <input type="number" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: +e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this shift" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            <span>Set as default shift</span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        title="Assign Shift to Employees"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={assigning} onClick={doAssign} disabled={selectedEmployees.length === 0}>
              Assign ({selectedEmployees.length})
            </Button>
          </>
        }
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEmployees.includes(emp.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                  else setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                }}
              />
              <div>
                <p className="text-sm font-medium text-content-primary">{emp.firstName} {emp.lastName}</p>
                <p className="text-xs text-content-tertiary">{emp.employeeCode} • {emp.designation || 'N/A'}</p>
              </div>
            </label>
          ))}
          {employees.length === 0 && <p className="text-sm text-content-tertiary text-center py-4">No employees found</p>}
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={detailShift?.name || 'Shift Details'}
        size="md"
      >
        {detailShift && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-content-tertiary">Code:</span> <span className="font-medium">{detailShift.code}</span></div>
              <div><span className="text-content-tertiary">Time:</span> <span className="font-medium">{detailShift.startTime} – {detailShift.endTime}</span></div>
              <div><span className="text-content-tertiary">Total:</span> <span className="font-medium">{Number(detailShift.totalHours)}h</span></div>
              <div><span className="text-content-tertiary">Working:</span> <span className="font-medium">{Number(detailShift.workingHours)}h</span></div>
            </div>
            {detailShift.assignments?.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-content-primary border-t border-surface-100 pt-3">Assigned Employees ({detailShift.assignments.length})</h4>
                <div className="space-y-2">
                  {detailShift.assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-50">
                      <div>
                        <p className="text-sm font-medium">{a.employee.firstName} {a.employee.lastName}</p>
                        <p className="text-xs text-content-tertiary">{a.employee.employeeCode} • {a.employee.designation || 'N/A'}</p>
                      </div>
                      <Badge variant="success" dot>Active</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
