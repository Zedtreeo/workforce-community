'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { usePermissions } from '../../../lib/use-permissions';
import { apiFetch, API_BASE } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { AssignmentModal } from '../../../components/assignment-modal';
import { Button, Card, Badge, PageSkeleton } from '../../../components/ui';
import { LettersCard } from '../../../components/letters/LettersCard';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  status: string;
  joinDate: string;
  salary: string;
  panNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankName?: string;
  bankBranch?: string;
  department?: { id: string; name: string } | null;
  reportingManager?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  tenant?: { name: string; currency: string } | null;
  createdAt: string;
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
  client: {
    id: string;
    name: string;
    country: string;
    currency: string;
  };
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  TERMINATED: 'danger',
};


function ApprovalBanner({ employee, refetch }: { employee: any; refetch: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const approvalStatus = employee?.approvalStatus;
  if (approvalStatus !== 'SUBMITTED' && approvalStatus !== 'INVITED' && approvalStatus !== 'REJECTED') {
    return null;
  }

  const onApprove = async () => {
    setBusy(true);
    try {
      await apiFetch(`/employees/${employee.id}/approve`, { method: 'POST' });
      await refetch();
    } finally { setBusy(false); }
  };
  const onReject = async () => {
    if (!rejectReason || rejectReason.length < 5) return alert('Reason required (min 5 chars)');
    setBusy(true);
    try {
      await apiFetch(`/employees/${employee.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      await refetch();
    } finally { setBusy(false); }
  };
  const onResendInvite = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ inviteToken: string }>(`/onboarding/${employee.id}/resend-invite`, { method: 'POST' });
      const link = `${window.location.origin}/onboarding/${res.inviteToken}`;
      try { await navigator.clipboard.writeText(link); } catch { /* clipboard may be blocked */ }
      alert('Onboarding invite re-sent by email. A fresh link was also copied to your clipboard.');
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to resend onboarding invite');
    } finally { setBusy(false); }
  };

  if (approvalStatus === 'SUBMITTED') {
    const fmtIST = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';
    return (
      <div className="mb-4 p-4 border-2 border-warning rounded-xl bg-warning/10">
        <div className="font-semibold text-content-primary mb-1">
          Application submitted — awaiting your review
        </div>
        <div className="text-sm text-content-secondary mb-3">
          The candidate has completed onboarding and accepted the offer letter.
          Review their personal details + documents below, optionally assign shift + pay structure,
          then enable portal access so they can log in.
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-content-secondary mb-3 p-3 bg-white/50 rounded-lg">
          <div>
            <div className="font-semibold text-content-primary">Offer accepted</div>
            <div>{fmtIST((employee as any).offerAcceptedAt)}</div>
          </div>
          <div>
            <div className="font-semibold text-content-primary">Application submitted</div>
            <div>{fmtIST((employee as any).submittedAt)}</div>
          </div>
          <div>
            <div className="font-semibold text-content-primary">Onboarding status</div>
            <div>{(employee as any).onboardingStatus || '—'}</div>
          </div>
        </div>
        {!showReject ? (
          <div className="flex gap-2">
            <button
              className="bg-success text-white px-4 py-2 rounded-lg disabled:opacity-50"
              onClick={onApprove}
              disabled={busy}
            >
              Approve & Enable Portal
            </button>
            <button
              className="bg-surface-100 text-content-primary px-4 py-2 rounded-lg border border-surface-300"
              onClick={() => setShowReject(true)}
              disabled={busy}
            >
              Reject
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-col">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (min 5 chars) — will be emailed to candidate"
              className="border border-surface-300 rounded-lg px-3 py-2 text-sm w-full"
              rows={3}
            />
            <div className="flex gap-2">
              <button className="bg-danger text-white px-4 py-2 rounded-lg disabled:opacity-50"
                onClick={onReject} disabled={busy}>Confirm reject</button>
              <button className="bg-surface-100 text-content-primary px-4 py-2 rounded-lg border border-surface-300"
                onClick={() => setShowReject(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }
  if (approvalStatus === 'INVITED') {
    const fmtIST = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';
    return (
      <div className="mb-4 p-4 border border-info rounded-xl bg-info/10 text-sm text-content-secondary">
        <strong>Invited:</strong> The candidate has been emailed an onboarding invite link.
        They have not yet accepted the offer or uploaded documents. Portal login only works
        after they complete onboarding and you approve them.
        <div className="mt-2 text-xs">
          Invited on: {fmtIST((employee as any).createdAt)} ·
          Invite expires: {fmtIST((employee as any).inviteExpiresAt)}
        </div>
        <div className="mt-3">
          <button
            className="bg-info text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            onClick={onResendInvite}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Resend Onboarding Invite'}
          </button>
        </div>
      </div>
    );
  }
  if (approvalStatus === 'REJECTED') {
    return (
      <div className="mb-4 p-4 border border-danger rounded-xl bg-danger/10">
        <div className="font-semibold text-content-primary mb-1">Application rejected</div>
        <div className="text-sm text-content-secondary">
          Reason: {employee.rejectedReason || '(none)'}
        </div>
      </div>
    );
  }
  return null;
}

interface UploadedDoc {
  id: string;
  fileName: string;
  fileSize?: number | null;
  createdAt: string;
  category?: { name: string; code: string } | null;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { canAccessPath } = usePermissions();
  // Compensation surfaces (pay structure, banking, CTC) are payroll data —
  // hide them for roles that can't reach payroll (the API strips them too).
  const canSeePay = canAccessPath('/payroll/pay-structures');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState(false);
  const [hasPortalAccess, setHasPortalAccess] = useState<boolean | null>(null);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [revokingAccess, setRevokingAccess] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [payTemplates, setPayTemplates] = useState<PayTemplate[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [ctcMonthly, setCtcMonthly] = useState('');
  const [savingShift, setSavingShift] = useState(false);
  const [savingPay, setSavingPay] = useState(false);

  const id = params.id as string;

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [emp, assignment] = await Promise.all([
        apiFetch<Employee>(`/employees/${id}`),
        apiFetch<ActiveAssignment | null>(`/assignments/active/${id}`),
      ]);
      setEmployee(emp);
      setActiveAssignment(assignment);
      apiFetch<{ hasAccess: boolean }>(`/employees/${id}/portal-access`).then(r => setHasPortalAccess(r.hasAccess)).catch(() => setHasPortalAccess(false));
      apiFetch<UploadedDoc[]>(`/documents?employeeId=${id}`).then(setUploadedDocs).catch(() => setUploadedDocs([]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    fetchAll();
    // Load shift types + pay templates for change modals
    apiFetch<ShiftType[]>('/shifts').then(setShiftTypes).catch(() => {});
    apiFetch<PayTemplate[]>('/pay-structure/templates').then((t: any) => {
      // API may return { data: [...] } or [...] 
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

  const handleDelete = async () => {
    if (!session || !confirm('Are you sure you want to deactivate this employee?')) return;
    try {
      await apiFetch(`/employees/${id}`, { method: 'DELETE' });
      router.push('/employees');
    } catch (err: any) {
      setError(err.message);
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

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !employee) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-danger-dark mb-4">{error || 'Employee not found'}</p>
          <Link href="/employees" className="text-brand-600 hover:underline text-sm">
            Back to Employees
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/employees" className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1">
              ← Back to Employees
            </Link>
            <h1 className="text-2xl font-bold text-content-primary">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-sm text-content-tertiary mt-0.5">
              {employee.employeeCode} · {employee.designation || 'No designation'}
              {(employee as any).approvalStatus && (employee as any).approvalStatus !== 'APPROVED' && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning">
                  {(employee as any).approvalStatus}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/attendance/${id}`}>
              <Button variant="secondary">View Attendance</Button>
            </Link>
            <Link href={`/employees/${id}/edit`}>
              <Button>Edit</Button>
            </Link>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>

        {/* Approval status banner — shows for SUBMITTED / INVITED / REJECTED only */}
        <ApprovalBanner employee={employee} refetch={fetchAll} />

        {/* Current Assignment Card */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">
                Current Client
              </p>
              {activeAssignment ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/clients/${activeAssignment.client.id}`}
                      className="text-lg font-semibold text-content-primary hover:text-brand-600 transition"
                    >
                      {activeAssignment.client.name}
                    </Link>
                    <span className="text-xs font-mono text-content-tertiary uppercase">
                      {activeAssignment.client.country}
                    </span>
                  </div>
                  <p className="text-sm text-content-secondary mt-1">
                    {activeAssignment.role ?? 'No role specified'} · Since{' '}
                    {new Date(activeAssignment.startDate).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm font-mono text-content-primary mt-2">
                    {activeAssignment.currency} {Number(activeAssignment.billingRate).toLocaleString()}{' '}
                    <span className="text-content-tertiary lowercase">/ {activeAssignment.billingCycle.toLowerCase()}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-content-tertiary mt-2">
                  Not currently assigned to any client. Available for new engagement.
                </p>
              )}
            </div>
            <div>
              {activeAssignment ? (
                <Button
                  variant="danger"
                  size="xs"
                  onClick={handleEndAssignment}
                  disabled={endingAssignment}
                  loading={endingAssignment}
                >
                  {endingAssignment ? 'Ending...' : 'End Assignment'}
                </Button>
              ) : (
                <Button size="xs" onClick={() => setShowAssignModal(true)}>
                  + Assign to Client
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Portal Access Card */}
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
        {canSeePay && (
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
        )}

        {/* Detail Card */}
        <Card padding="none">
          <div className="divide-y divide-surface-100">
            <Section title="Basic Information">
              <Row label="Status">
                <Badge variant={STATUS_VARIANT[employee.status] || 'default'}>
                  {employee.status}
                </Badge>
              </Row>
              <Row label="Email">{employee.email}</Row>
              <Row label="Phone">{employee.phone || '—'}</Row>
              <Row label="Department">{employee.department?.name || '—'}</Row>
              <Row label="Reporting To">{employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName} (${employee.reportingManager.employeeCode})` : '—'}</Row>
              <Row label="Engagement">{(employee as any).engagementType === 'CONSULTANT' ? 'Consultant (flat % TDS)' : 'Employee (salaried)'}</Row>
            </Section>

            <Section title="Employment Details">
              <Row label="Join Date">
                {new Date(employee.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Row>
              {employee.salary != null && (
                <Row label="Annual Salary">₹{Number(employee.salary).toLocaleString('en-IN')}</Row>
              )}
            </Section>

            {canSeePay && (
            <Section title="Statutory & Banking">
              <Row label="PAN">{employee.panNumber || '—'}</Row>
              <Row label="PF Number">{employee.pfNumber || '—'}</Row>
              <Row label="ESI Number">{employee.esiNumber || '—'}</Row>
              <Row label="Bank Account">{employee.bankAccount || '—'}</Row>
              <Row label="IFSC Code">{employee.bankIfsc || '—'}</Row>
              <Row label="Bank Name">{employee.bankName || '—'}</Row>
              <Row label="Bank Branch">{employee.bankBranch || '—'}</Row>
            </Section>
            )}
          </div>
        </Card>


        {/* Uploaded onboarding documents (PAN card, bank proof, etc.) */}
        <Card className="mt-6">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Uploaded Documents</h3>
          {uploadedDocs.length === 0 ? (
            <p className="text-sm text-content-tertiary">No documents uploaded by this employee.</p>
          ) : (
            <div className="divide-y divide-surface-100">
              {uploadedDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-content-primary">{d.category?.name || 'Document'}</p>
                    <p className="text-xs text-content-tertiary">
                      {d.fileName}
                      {d.fileSize ? ` · ${(d.fileSize / 1024).toFixed(0)} KB` : ''}
                      {' · '}
                      {new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <a
                    href={`${API_BASE}/documents/${d.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Documents — Offer / Appointment / Experience letters */}
        <div className="mt-6">
          <LettersCard
            scope="employee"
            employeeId={id}
            state={{
              onboardingStatus: (employee as any).onboardingStatus,
              hasPortalAccess: hasPortalAccess === true,
              exitDate: (employee as any).exitDate ?? null,
              hasActiveAssignment: Boolean((employee as any).assignments?.some((a: any) => a.status === 'ACTIVE')),
            }}
          />
        </div>

        {showAssignModal && (
          <AssignmentModal
            employeeId={id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            onClose={() => setShowAssignModal(false)}
            onSuccess={() => {
              setShowAssignModal(false);
              fetchAll();
            }}
          />
        )}
        {/* Shift Assignment Modal */}
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

        {/* Pay Structure Assignment Modal */}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-content-primary uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start">
      <span className="w-40 text-sm text-content-tertiary shrink-0">{label}</span>
      <span className="text-sm text-content-primary">{children}</span>
    </div>
  );
}
