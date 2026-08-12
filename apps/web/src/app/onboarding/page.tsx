'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch, apiUpload, API_BASE } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import {
  Button, Badge, Card, Modal, PageHeader, PageSkeleton,
  DataTable, TableToolbar, Select,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { Plus, UserPlus, Copy, RefreshCw, Send, Eye, FileText, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { LetterGenerateDialog } from '../../components/letters/LetterGenerateDialog';

type OnboardingStatus = 'INVITED' | 'OFFER_PENDING' | 'DETAILS_PENDING' | 'DOCUMENTS_PENDING' | 'COMPLETED';

const STATUS_BADGE: Record<OnboardingStatus, 'warning' | 'info' | 'brand' | 'default' | 'success'> = {
  INVITED: 'warning',
  OFFER_PENDING: 'info',
  DETAILS_PENDING: 'brand',
  DOCUMENTS_PENDING: 'default',
  COMPLETED: 'success',
};

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  INVITED: 'Invited',
  OFFER_PENDING: 'Offer Pending',
  DETAILS_PENDING: 'Details Pending',
  DOCUMENTS_PENDING: 'Docs Pending',
  COMPLETED: 'Completed',
};

const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Invited', value: 'INVITED' },
  { label: 'Offer Pending', value: 'OFFER_PENDING' },
  { label: 'Details Pending', value: 'DETAILS_PENDING' },
  { label: 'Docs Pending', value: 'DOCUMENTS_PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
];

interface OnboardingEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  onboardingStatus: OnboardingStatus;
  inviteToken: string;
  createdAt: string;
  offerAcceptedAt: string | null;
  offerLetter: { status: string; designation: string; joiningDate: string } | null;
  _count: { documents: number };
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<OnboardingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');
  const [offerFor, setOfferFor] = useState<OnboardingEmployee | null>(null);

  const fetchList = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiFetch<OnboardingEmployee[]>(`/onboarding/list${params}`);
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const handleResend = async (employeeId: string) => {
    try {
      const res = await apiFetch<{ inviteToken: string }>(`/onboarding/${employeeId}/resend-invite`, { method: 'POST' });
      const link = `${window.location.origin}/onboarding/${res.inviteToken}`;
      navigator.clipboard.writeText(link);
      alert('Invite resent! New link copied to clipboard.');
      fetchList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (emp: OnboardingEmployee) => {
    if (!confirm(`Delete ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) from onboarding? This removes the invite and offer letter.`)) return;
    try {
      await apiFetch(`/onboarding/${emp.id}`, { method: 'DELETE' });
      fetchList();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const columns: Column<OnboardingEmployee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (emp) => (
        <div>
          <p className="font-medium text-content-primary">{emp.firstName} {emp.lastName}</p>
          <p className="text-xs text-content-tertiary">{emp.email}</p>
        </div>
      ),
    },
    { key: 'employeeCode', header: 'Code', className: 'font-mono text-xs text-content-secondary' },
    {
      key: 'designation',
      header: 'Designation',
      render: (emp) => <span className="text-content-secondary">{emp.designation || '—'}</span>,
    },
    {
      key: 'onboardingStatus',
      header: 'Status',
      render: (emp) => (
        <Badge variant={STATUS_BADGE[emp.onboardingStatus] || 'secondary'} dot>
          {STATUS_LABELS[emp.onboardingStatus] || emp.onboardingStatus}
        </Badge>
      ),
    },
    {
      key: 'docs',
      header: 'Docs',
      render: (emp) => <span className="text-content-secondary">{emp._count.documents} uploaded</span>,
    },
    {
      key: 'joiningDate',
      header: 'Joining Date',
      render: (emp) => (
        <span className="text-content-secondary">
          {emp.offerLetter ? new Date(emp.offerLetter.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (emp) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="xs" icon={<FileText size={14} />}
            onClick={() => setOfferFor(emp)}>
            Offer Letter
          </Button>
          {emp.onboardingStatus !== 'COMPLETED' && (
            <>
              <Button variant="ghost" size="xs" icon={<Copy size={14} />}
                onClick={() => handleCopyLink(emp.inviteToken)}>
                {copiedToken === emp.inviteToken ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button variant="ghost" size="xs" icon={<RefreshCw size={14} />}
                onClick={() => handleResend(emp.id)}>
                Resend
              </Button>
            </>
          )}
          <Button variant="ghost" size="xs" icon={<Trash2 size={14} />}
            className="text-danger-dark hover:bg-danger-light"
            onClick={() => handleDelete(emp)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading && employees.length === 0) {
    return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Employee Onboarding"
          description={`${employees.length} employees in onboarding pipeline`}
          breadcrumbs={[{ label: 'Onboarding' }]}
          actions={
            <Button icon={<UserPlus size={16} />} onClick={() => setShowCreate(true)}>
              Invite Employee
            </Button>
          }
        />

        <DataTable<OnboardingEmployee>
          columns={columns}
          data={employees}
          rowKey={(emp) => emp.id}
          loading={loading}
          loadingRows={5}
          emptyMessage="No employees in onboarding pipeline yet."
          emptyIcon={<UserPlus />}
          toolbar={
            <TableToolbar search="" onSearchChange={() => {}} searchPlaceholder="">
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </TableToolbar>
          }
        />
      </div>

      {showCreate && (
        <CreateOnboardingModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); fetchList(); }} />
      )}

      {offerFor && (
        <LetterGenerateDialog
          open={!!offerFor}
          onClose={() => setOfferFor(null)}
          type="OFFER_LETTER"
          employeeId={offerFor.id}
        />
      )}
    </DashboardLayout>
  );
}

// ── Create Onboarding Modal ──

const WORK_HOURS: Record<string, string> = {
  FULL_TIME: '9:30 AM to 6:30 PM, Monday to Friday',
  PART_TIME: '9:30 AM to 1:30 PM, Monday to Friday',
};
const WORK_LOCATIONS = ['Remote', 'Hybrid', 'Work From Home', 'Office — New Delhi', 'Office — Noida'];

function CreateOnboardingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: '',
    // Offer letter fields
    designation: '',
    salary: '',
    joiningDate: '',
    probationMonths: '6',
    workLocation: 'Remote',
    reportingTo: 'HR Department',
    employmentType: 'FULL_TIME',
    workSchedule: WORK_HOURS.FULL_TIME,
    benefits: '',
    terms: '',
  });
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [autoCode, setAutoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ inviteToken: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [resumeName, setResumeName] = useState('');

  const handleResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const c = await apiUpload<{
        firstName?: string; lastName?: string; email?: string; phone?: string; currentTitle?: string;
      }>('/onboarding/parse-resume', fd);
      setForm(prev => ({
        ...prev,
        firstName: c.firstName || prev.firstName,
        lastName: c.lastName || prev.lastName,
        email: c.email || prev.email,
        phone: c.phone || prev.phone,
        designation: prev.designation || c.currentTitle || '',
      }));
      setResumeName(file.name);
    } catch (err: any) {
      setError(err?.message || 'Could not read that resume. Try a clear PDF or image.');
    } finally {
      setParsing(false);
    }
  };

  useEffect(() => {
    apiFetch<{ data: { id: string; name: string }[] }>('/departments?limit=100')
      .then(res => setDepartments(res.data || []))
      .catch(() => {});
    apiFetch<{ code: string }>('/onboarding/next-employee-code')
      .then(res => setAutoCode(res.code))
      .catch(() => {});
    apiFetch<string[]>('/employees/designations')
      .then(res => setDesignations(res || []))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Switching Full/Part time auto-sets the matching working-hours default.
  const handleEmploymentType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setForm(prev => ({ ...prev, employmentType: t, workSchedule: WORK_HOURS[t] || prev.workSchedule }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        departmentId: form.departmentId || undefined,
        offerLetter: {
          designation: form.designation,
          department: departments.find(d => d.id === form.departmentId)?.name || '',
          salary: form.salary,
          joiningDate: form.joiningDate,
          probationMonths: parseInt(form.probationMonths) || 6,
          workLocation: form.workLocation || undefined,
          reportingTo: form.reportingTo || undefined,
          employmentType: form.employmentType,
          workSchedule: form.workSchedule || undefined,
          benefits: form.benefits || undefined,
          terms: form.terms || undefined,
        },
      };
      const res = await apiFetch<{ inviteToken: string }>('/onboarding/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (result) {
      navigator.clipboard.writeText(`${window.location.origin}/onboarding/${result.inviteToken}`);
      alert('Invite link copied!');
      onSuccess();
    }
  };

  if (result) {
    return (
      <Modal open onClose={onClose} title="Employee Invited Successfully">
        <div className="space-y-4">
          <p className="text-sm text-content-secondary">
            Employee has been created. Share the onboarding link below with them:
          </p>
          <div className="p-3 bg-surface-secondary rounded-lg font-mono text-xs break-all">
            {window.location.origin}/onboarding/{result.inviteToken}
          </div>
          <div className="flex gap-2">
            <Button icon={<Copy size={16} />} onClick={copyLink}>Copy Link</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Invite New Employee" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-danger-light border border-danger rounded-lg text-sm text-danger-dark">{error}</div>
        )}

        {/* Resume auto-fill */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 p-3">
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <Sparkles size={16} className="text-indigo-500" />
            {parsing ? (
              <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Reading résumé…</span>
            ) : resumeName ? (
              <span>Filled from <span className="font-medium">{resumeName}</span> — review the fields below.</span>
            ) : (
              <span>Upload a résumé (PDF or image) to auto-fill the candidate’s details.</span>
            )}
          </div>
          <label className="shrink-0 cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            {resumeName ? 'Replace' : 'Upload résumé'}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleResume} disabled={parsing} />
          </label>
        </div>

        {/* Employee Info */}
        <div>
          <h4 className="text-sm font-semibold text-content-primary mb-3 uppercase tracking-wider">Employee Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Employee Code</label>
              <input value={autoCode || 'Auto-assigned on invite'} readOnly disabled
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-surface-50 text-content-secondary text-sm font-mono cursor-not-allowed" />
              <p className="text-xs text-content-tertiary mt-1">Auto-generated, continues from the latest code.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="rahul@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">First Name *</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} required
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="Rahul" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Last Name *</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} required
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="Sharma" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Department</label>
              <select name="departmentId" value={form.departmentId} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary">
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Offer Letter Details */}
        <div>
          <h4 className="text-sm font-semibold text-content-primary mb-3 uppercase tracking-wider">Offer Letter Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Designation *</label>
              <input name="designation" value={form.designation} onChange={handleChange} required list="designation-options"
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                placeholder="Select or type to create…" autoComplete="off" />
              <datalist id="designation-options">
                {designations.map(d => <option key={d} value={d} />)}
              </datalist>
              <p className="text-xs text-content-tertiary mt-1">Pick an existing one or type a new designation to create it.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Monthly Salary (CTC) *</label>
              <input name="salary" type="number" value={form.salary} onChange={handleChange} required
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="50000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Joining Date *</label>
              <input name="joiningDate" type="date" value={form.joiningDate} onChange={handleChange} required
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Probation (months)</label>
              <input name="probationMonths" type="number" value={form.probationMonths} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Work Location</label>
              <select name="workLocation" value={form.workLocation} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary">
                {WORK_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Reporting To</label>
              <input name="reportingTo" value={form.reportingTo} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" placeholder="Manager Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Employment Type *</label>
              <select name="employmentType" value={form.employmentType} onChange={handleEmploymentType}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary">
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-content-secondary mb-1">Working Hours</label>
              <input name="workSchedule" value={form.workSchedule} onChange={handleChange}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-content-secondary mb-1">Benefits</label>
              <textarea name="benefits" value={form.benefits} onChange={handleChange} rows={2}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none"
                placeholder="Health insurance, PF, etc." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-content-secondary mb-1">Additional Terms</label>
              <textarea name="terms" value={form.terms} onChange={handleChange} rows={3}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-white text-content-primary text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none"
                placeholder="Any additional terms and conditions..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" icon={<Send size={16} />} loading={submitting}>
            Create & Generate Invite Link
          </Button>
        </div>
      </form>
    </Modal>
  );
}

