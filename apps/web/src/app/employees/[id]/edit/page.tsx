'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '../../../../lib/auth-client';
import { apiFetch } from '../../../../lib/api';
import { DashboardLayout } from '../../../../components/dashboard-layout';
import { EmployeeForm, EmployeeFormData } from '../../../../components/employee-form';
import { AssignmentModal } from '../../../../components/assignment-modal';
import { Card, Button, Badge, PageSkeleton } from '../../../../components/ui';

interface EmployeeRaw {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  departmentId?: string;
  reportingManagerId?: string;
  joinDate: string;
  status: string;
  salary: string;
  panNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
  bankAccount?: string;
  bankIfsc?: string;
  shifts?: { id: string; shiftType: { id: string; name: string; code: string; startTime: string; endTime: string } }[];
  payStructureAssignments?: { id: string; template: { id: string; name: string }; ctcMonthly?: string }[];
}

interface ShiftType {
  id: string; name: string; code: string; startTime: string; endTime: string;
}

interface PayTemplate {
  id: string; name: string;
}

interface ActiveAssignment {
  id: string;
  role?: string | null;
  startDate: string;
  billingRate: string;
  currency: string;
  billingCycle: string;
  status: string;
  client: { id: string; name: string; country: string; currency: string };
}

export default function EditEmployeePage() {
  const params = useParams();
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<EmployeeRaw | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Portal access
  const [hasPortalAccess, setHasPortalAccess] = useState<boolean | null>(null);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [revokingAccess, setRevokingAccess] = useState(false);

  // Shift
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Pay structure
  const [payTemplates, setPayTemplates] = useState<PayTemplate[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [ctcMonthly, setCtcMonthly] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Client assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState(false);

  const id = params.id as string;

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [emp, assignment] = await Promise.all([
        apiFetch<EmployeeRaw>(`/employees/${id}`),
        apiFetch<ActiveAssignment | null>(`/assignments/active/${id}`),
      ]);
      setEmployee(emp);
      setActiveAssignment(assignment);
      apiFetch<{ hasAccess: boolean }>(`/employees/${id}/portal-access`)
        .then(r => setHasPortalAccess(r.hasAccess))
        .catch(() => setHasPortalAccess(false));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    fetchAll();
    apiFetch<ShiftType[]>('/shifts').then(setShiftTypes).catch(() => {});
    apiFetch<PayTemplate[]>('/pay-structure/templates').then((t: any) => {
      setPayTemplates(Array.isArray(t) ? t : t.data || []);
    }).catch(() => {});
  }, [session, fetchAll]);

  const handleAssignShift = async () => {
    if (!selectedShiftId) return;
    setSavingShift(true);
    try {
      await apiFetch('/shifts/assign', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: id,
          shiftTypeId: selectedShiftId,
          effectiveFrom: new Date().toISOString().split('T')[0],
        }),
      });
      setShowShiftModal(false);
      await fetchAll();
    } catch (err: any) {
      alert(err.message || 'Failed to assign shift');
    } finally {
      setSavingShift(false);
    }
  };

  const handleAssignPayStructure = async () => {
    if (!selectedTemplateId || !ctcMonthly) return;
    setSavingPay(true);
    try {
      await apiFetch('/pay-structure/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: id,
          templateId: selectedTemplateId,
          ctcMonthly: Number(ctcMonthly),
          effectiveFrom: new Date().toISOString().split('T')[0],
        }),
      });
      setShowPayModal(false);
      await fetchAll();
    } catch (err: any) {
      alert(err.message || 'Failed to assign pay structure');
    } finally {
      setSavingPay(false);
    }
  };

  const handleGrantPortalAccess = async () => {
    setGrantingAccess(true);
    try {
      const res = await apiFetch<{ message?: string }>(`/employees/${id}/grant-portal-access`, { method: 'POST' });
      setHasPortalAccess(true);
      alert(res?.message || 'Portal access enabled. The employee signs in with an email one-time code (OTP).');
    } catch (err: any) {
      alert(err.message || 'Failed to enable portal access');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleRevokePortalAccess = async () => {
    if (!confirm('Disable portal access for this employee? They will be signed out and cannot log in until you re-enable it.')) return;
    setRevokingAccess(true);
    try {
      const res = await apiFetch<{ message?: string }>(`/employees/${id}/portal-access`, { method: 'DELETE' });
      setHasPortalAccess(false);
      alert(res?.message || 'Portal access disabled.');
    } catch (err: any) {
      alert(err.message || 'Failed to disable portal access');
    } finally {
      setRevokingAccess(false);
    }
  };

  const handleEndAssignment = async () => {
    if (!activeAssignment) return;
    if (!confirm(`End assignment with ${activeAssignment.client.name}?`)) return;
    setEndingAssignment(true);
    try {
      await apiFetch(`/assignments/${activeAssignment.id}/end`, {
        method: 'POST',
        body: JSON.stringify({
          endDate: new Date().toISOString().split('T')[0],
          status: 'COMPLETED',
        }),
      });
      await fetchAll();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to end assignment');
    } finally {
      setEndingAssignment(false);
    }
  };

  if (loading) {
    return <DashboardLayout><PageSkeleton /></DashboardLayout>;
  }

  if (error || !employee) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-danger-dark mb-4">{error || 'Employee not found'}</p>
          <Link href="/employees" className="text-brand-600 hover:underline text-sm">Back to Employees</Link>
        </div>
      </DashboardLayout>
    );
  }

  const initialData: Partial<EmployeeFormData> = {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone || '',
    designation: employee.designation || '',
    departmentId: employee.departmentId || '',
    reportingManagerId: employee.reportingManagerId || '',
    joinDate: employee.joinDate ? employee.joinDate.split('T')[0] : '',
    status: employee.status,
    engagementType: (employee as any).engagementType || 'EMPLOYEE',
    salary: String(employee.salary),
    panNumber: employee.panNumber || '',
    pfNumber: employee.pfNumber || '',
    esiNumber: employee.esiNumber || '',
    bankAccount: employee.bankAccount || '',
    bankIfsc: employee.bankIfsc || '',
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div>
          <Link href={`/employees/${id}`} className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1">
            ← Back to Employee
          </Link>
          <h1 className="text-2xl font-bold text-content-primary mb-6">
            Edit: {employee.firstName} {employee.lastName}
          </h1>
        </div>

        {/* Basic Information Form */}
        <Card>
          <EmployeeForm mode="edit" employeeId={id} initialData={initialData} />
        </Card>

        {/* Current Client Card */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">Current Client</p>
              {activeAssignment ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <Link href={`/clients/${activeAssignment.client.id}`} className="text-lg font-semibold text-content-primary hover:text-brand-600 transition">
                      {activeAssignment.client.name}
                    </Link>
                    <span className="text-xs font-mono text-content-tertiary uppercase">{activeAssignment.client.country}</span>
                  </div>
                  <p className="text-sm text-content-secondary mt-1">
                    {activeAssignment.role ?? 'No role specified'} · Since{' '}
                    {new Date(activeAssignment.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-sm font-mono text-content-primary mt-2">
                    {activeAssignment.currency} {Number(activeAssignment.billingRate).toLocaleString()}{' '}
                    <span className="text-content-tertiary lowercase">/ {activeAssignment.billingCycle.toLowerCase()}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-content-tertiary mt-2">Not currently assigned to any client. Available for new engagement.</p>
              )}
            </div>
            <div>
              {activeAssignment ? (
                <Button variant="danger" size="xs" onClick={handleEndAssignment} disabled={endingAssignment} loading={endingAssignment}>
                  {endingAssignment ? 'Ending...' : 'End Assignment'}
                </Button>
              ) : (
                <Button size="xs" onClick={() => setShowAssignModal(true)}>+ Assign to Client</Button>
              )}
            </div>
          </div>
        </Card>

        {/* Portal Access Card — same OTP toggle as the employee detail page */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Portal Access</h3>
              <p className="text-xs text-content-tertiary mt-0.5">
                {hasPortalAccess === null
                  ? 'Checking…'
                  : hasPortalAccess
                    ? 'Enabled — the employee signs in with an email one-time code (OTP).'
                    : 'Disabled — the employee cannot sign in.'}
              </p>
            </div>
            {hasPortalAccess !== null && (
              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-medium ${hasPortalAccess ? 'text-success-dark' : 'text-content-tertiary'}`}>
                  {grantingAccess || revokingAccess ? 'Saving…' : hasPortalAccess ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasPortalAccess}
                  aria-label="Toggle portal access"
                  disabled={grantingAccess || revokingAccess}
                  onClick={hasPortalAccess ? handleRevokePortalAccess : handleGrantPortalAccess}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${hasPortalAccess ? 'bg-success' : 'bg-surface-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hasPortalAccess ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Shift Card */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">Current Shift</p>
              {employee.shifts?.[0] ? (
                <div className="mt-2">
                  <p className="text-lg font-semibold text-content-primary">{employee.shifts[0].shiftType.name}</p>
                  <p className="text-sm text-content-secondary mt-0.5">
                    {employee.shifts[0].shiftType.startTime} – {employee.shifts[0].shiftType.endTime} · Code: {employee.shifts[0].shiftType.code}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-content-tertiary mt-2">No shift assigned</p>
              )}
            </div>
            <Button size="xs" variant="secondary" onClick={() => {
              setSelectedShiftId(employee.shifts?.[0]?.shiftType?.id || '');
              setShowShiftModal(true);
            }}>
              {employee.shifts?.[0] ? 'Change Shift' : 'Assign Shift'}
            </Button>
          </div>
        </Card>

        {/* Pay Structure Card */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">Pay Structure</p>
              {employee.payStructureAssignments?.[0] ? (
                <div className="mt-2">
                  <p className="text-lg font-semibold text-content-primary">{employee.payStructureAssignments[0].template.name}</p>
                  {employee.payStructureAssignments[0].ctcMonthly && (
                    <p className="text-sm font-mono text-content-secondary mt-0.5">
                      ₹{Number(employee.payStructureAssignments[0].ctcMonthly).toLocaleString('en-IN')} / month
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-content-tertiary mt-2">No pay structure assigned</p>
              )}
            </div>
            <Button size="xs" variant="secondary" onClick={() => {
              setSelectedTemplateId(employee.payStructureAssignments?.[0]?.template?.id || '');
              setCtcMonthly(employee.payStructureAssignments?.[0]?.ctcMonthly || '');
              setShowPayModal(true);
            }}>
              {employee.payStructureAssignments?.[0] ? 'Change Pay Structure' : 'Assign Pay Structure'}
            </Button>
          </div>
        </Card>

        {/* Modals */}
        {showAssignModal && (
          <AssignmentModal
            employeeId={id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            onClose={() => setShowAssignModal(false)}
            onSuccess={() => { setShowAssignModal(false); fetchAll(); }}
          />
        )}

        {showShiftModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-content-primary">Assign Shift</h3>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Shift Type</label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white text-content-primary"
                >
                  <option value="">Select shift...</option>
                  {shiftTypes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowShiftModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAssignShift} loading={savingShift} disabled={!selectedShiftId}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {showPayModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-content-primary">Assign Pay Structure</h3>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Pay Structure Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white text-content-primary"
                >
                  <option value="">Select template...</option>
                  {payTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Monthly CTC (₹)</label>
                <input
                  type="number"
                  value={ctcMonthly}
                  onChange={(e) => setCtcMonthly(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white text-content-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowPayModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAssignPayStructure} loading={savingPay} disabled={!selectedTemplateId || !ctcMonthly}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
