'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../lib/auth-client';
import { apiFetch } from '../lib/api';

export interface EmployeeFormData {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  departmentId: string;
  reportingManagerId: string;
  joinDate: string;
  status: string;
  engagementType: string;
  consultantTdsRate: string;
  taxRegime: string;
  salary: string;
  panNumber: string;
  pfNumber: string;
  esiNumber: string;
  bankAccount: string;
  bankIfsc: string;
  grantPortalAccess: boolean;
}

const EMPTY_FORM: EmployeeFormData = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  departmentId: '',
  reportingManagerId: '',
  joinDate: '',
  status: 'ACTIVE',
  engagementType: 'EMPLOYEE',
  consultantTdsRate: '2',
  taxRegime: 'NEW',
  salary: '',
  panNumber: '',
  pfNumber: '',
  esiNumber: '',
  bankAccount: '',
  bankIfsc: '',
  grantPortalAccess: true,
};

interface Props {
  mode: 'create' | 'edit';
  employeeId?: string;
  initialData?: Partial<EmployeeFormData>;
}

export function EmployeeForm({ mode, employeeId, initialData }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState<EmployeeFormData>({ ...EMPTY_FORM, ...initialData });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [managers, setManagers] = useState<Array<{ id: string; firstName: string; lastName: string; employeeCode: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ data: typeof managers }>('/employees?limit=500&status=ACTIVE')
      .then((res) => setManagers(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setManagers([]));
    apiFetch<{ data: typeof departments }>('/departments?limit=100')
      .then((res) => setDepartments(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setDepartments([]));
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError('');
    setSubmitting(true);

    try {
      // Build payload — omit empty optional fields
      const payload: Record<string, string | boolean | null> = {};
      const required = ['employeeCode', 'firstName', 'lastName', 'email', 'joinDate', 'salary'] as const;
      for (const key of required) {
        if (!form[key]) {
          setError(`${key} is required`);
          setSubmitting(false);
          return;
        }
        payload[key] = form[key];
      }
      // Optional fields
      const optional = ['phone', 'designation', 'departmentId', 'status', 'engagementType', 'consultantTdsRate', 'taxRegime', 'panNumber', 'pfNumber', 'esiNumber', 'bankAccount', 'bankIfsc'] as const;
      for (const key of optional) {
        const val = form[key];
        if (val) payload[key] = val;
      }
      // Reporting manager: send the id to set, or null to clear it
      payload.reportingManagerId = form.reportingManagerId || null;

      if (mode === 'create') {
        await apiFetch('/employees', {
          method: 'POST',
          body: JSON.stringify({ ...payload, grantPortalAccess: form.grantPortalAccess }),
        });
      } else {
        await apiFetch(`/employees/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      router.push('/employees');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 bg-danger-light border border-danger rounded-lg text-sm text-danger-dark">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <section>
        <h3 className="text-sm font-semibold text-content-primary mb-4 uppercase tracking-wider">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Employee Code" name="employeeCode" value={form.employeeCode} onChange={handleChange} required disabled={mode === 'edit'} placeholder="EMP001" />
          <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="rahul@company.com" />
          <Field label="First Name" name="firstName" value={form.firstName} onChange={handleChange} required placeholder="Rahul" />
          <Field label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} required placeholder="Sharma" />
          <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+91-9876543210" />
          <Field label="Designation" name="designation" value={form.designation} onChange={handleChange} placeholder="Senior Developer" />
        </div>
      </section>

      {/* Employment Details */}
      <section>
        <h3 className="text-sm font-semibold text-content-primary mb-4 uppercase tracking-wider">Employment Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Join Date" name="joinDate" type="date" value={form.joinDate} onChange={handleChange} required />
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Engagement Type</label>
            <select
              name="engagementType"
              value={form.engagementType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              <option value="EMPLOYEE">Employee (salaried, slab TDS)</option>
              <option value="CONSULTANT">Consultant (flat % TDS)</option>
            </select>
          </div>
          {form.engagementType === 'CONSULTANT' && (
            <Field label="Consultant TDS Rate (%)" name="consultantTdsRate" value={form.consultantTdsRate} onChange={handleChange} placeholder="2" />
          )}
          {form.engagementType !== 'CONSULTANT' && (
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Tax Regime</label>
              <select
                name="taxRegime"
                value={form.taxRegime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="NEW">New Regime</option>
                <option value="OLD">Old Regime</option>
              </select>
            </div>
          )}
          <Field label="Annual Salary (INR)" name="salary" value={form.salary} onChange={handleChange} required placeholder="900000.00" />
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Department</label>
            <select
              name="departmentId"
              value={form.departmentId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {departments.length === 0 && (
              <p className="mt-1 text-xs text-content-tertiary">No departments yet — create them under Departments first.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Reporting To</label>
            <select
              name="reportingManagerId"
              value={form.reportingManagerId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              <option value="">— None —</option>
              {managers.filter((m) => m.id !== employeeId).map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.employeeCode})</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Portal Access */}
      {mode === 'create' && (
        <section>
          <h3 className="text-sm font-semibold text-content-primary mb-4 uppercase tracking-wider">Portal Access</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.grantPortalAccess}
              onChange={(e) => setForm((prev) => ({ ...prev, grantPortalAccess: e.target.checked }))}
              className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-content-primary">Grant portal access</p>
              <p className="text-xs text-content-tertiary">Create a login account and send credentials via email</p>
            </div>
          </label>
        </section>
      )}

      {/* Statutory & Banking */}
      <section>
        <h3 className="text-sm font-semibold text-content-primary mb-4 uppercase tracking-wider">Statutory & Banking</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PAN Number" name="panNumber" value={form.panNumber} onChange={handleChange} placeholder="ABCDE1234F" />
          <Field label="PF Number" name="pfNumber" value={form.pfNumber} onChange={handleChange} placeholder="MH/BAN/12345/000/0001234" />
          <Field label="ESI Number" name="esiNumber" value={form.esiNumber} onChange={handleChange} placeholder="1234567890" />
          <Field label="Bank Account" name="bankAccount" value={form.bankAccount} onChange={handleChange} placeholder="12345678901234" />
          <Field label="Bank IFSC" name="bankIfsc" value={form.bankIfsc} onChange={handleChange} placeholder="SBIN0001234" />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Employee' : 'Update Employee'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/employees')}
          className="px-5 py-2 bg-surface-100 text-content-secondary text-sm font-medium rounded-lg hover:bg-surface-200 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label, name, value, onChange, type = 'text', required = false, disabled = false, placeholder = '',
}: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; required?: boolean; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">
        {label} {required && <span className="text-danger-dark">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:bg-surface-100 disabled:text-content-tertiary"
      />
    </div>
  );
}
