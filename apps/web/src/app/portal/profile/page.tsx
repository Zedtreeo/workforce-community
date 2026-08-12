'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import {
  Button, Card, Badge, PageSkeleton, PageHeader,
} from '../../../components/ui';
import { User, CheckCircle, XCircle, Clock, Save } from 'lucide-react';

interface Profile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  departmentId: string | null;
  joinDate: string;
  status: string;
  pfNumber: string | null;
  esiNumber: string | null;
  panNumber: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
}

interface ChangeRequest {
  id: string;
  changes: Record<string, { old: any; new: any }>;
  status: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  designation: 'Designation',
  pfNumber: 'PF Number',
  esiNumber: 'ESI Number',
  panNumber: 'PAN Number',
  bankAccount: 'Bank Account',
  bankIfsc: 'Bank IFSC',
};

const EDITABLE_FIELDS = Object.keys(FIELD_LABELS);

export default function PortalProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingChanges, setPendingChanges] = useState<ChangeRequest[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeRequest[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!session?.session?.token) return;
    loadProfile();
  }, [session?.session?.token]);

  const loadProfile = async () => {
    try {
      const data = await apiFetch<{
        profile: Profile;
        pendingChanges: ChangeRequest[];
        changeHistory: ChangeRequest[];
      }>('/portal/profile');
      setProfile(data.profile);
      setPendingChanges(data.pendingChanges);
      setChangeHistory(data.changeHistory);
      // Initialize form with current values
      const formData: Record<string, string> = {};
      for (const field of EDITABLE_FIELDS) {
        formData[field] = (data.profile as any)[field] || '';
      }
      setForm(formData);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string | null> = {};
      for (const field of EDITABLE_FIELDS) {
        const newVal = form[field]?.trim() || null;
        const oldVal = (profile as any)[field] || null;
        if (newVal !== oldVal) {
          body[field] = newVal;
        }
      }
      if (Object.keys(body).length === 0) {
        setMessage({ type: 'error', text: 'No changes to submit' });
        setSaving(false);
        return;
      }
      await apiFetch('/portal/profile-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setMessage({ type: 'success', text: 'Profile update request submitted for admin approval' });
      setEditing(false);
      loadProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit changes' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <Card className="bg-warning-light border-warning p-6">
            <p className="text-warning-dark font-medium">Profile not found. Please contact your administrator.</p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const hasPending = pendingChanges.length > 0;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="My Profile"
          description="View and update your personal information"
          breadcrumbs={[{ label: 'Portal', href: '/portal' }, { label: 'Profile' }]}
          actions={
            !editing ? (
              <Button onClick={() => setEditing(true)} disabled={hasPending}>
                {hasPending ? 'Changes Pending Approval' : 'Edit Profile'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setEditing(false); setMessage(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              </div>
            )
          }
        />

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Pending Changes Banner */}
        {hasPending && (
          <Card className="bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <Clock size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Pending Profile Changes</p>
                <p className="text-xs text-amber-600 mt-1">Your profile update request is awaiting admin approval. You cannot submit new changes until the current request is reviewed.</p>
                <div className="mt-3 space-y-1">
                  {Object.entries(pendingChanges[0].changes as Record<string, { old: any; new: any }>).map(([field, val]) => (
                    <div key={field} className="text-xs text-amber-700">
                      <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{' '}
                      <span className="line-through text-amber-500">{val.old || '—'}</span>{' → '}
                      <span className="font-semibold">{val.new || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Profile Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Read-only info */}
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-4">Employment Information</h3>
            <div className="space-y-3">
              <InfoRow label="Employee Code" value={profile.employeeCode} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Department" value={profile.department || '—'} />
              <InfoRow label="Join Date" value={new Date(profile.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <InfoRow label="Status" value={profile.status} badge />
            </div>
          </Card>

          {/* Editable fields */}
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-4">Personal Information</h3>
            <div className="space-y-3">
              {EDITABLE_FIELDS.slice(0, 4).map((field) => (
                <EditableRow
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={form[field] || ''}
                  editing={editing}
                  onChange={(v) => setForm({ ...form, [field]: v })}
                  original={(profile as any)[field] || ''}
                />
              ))}
            </div>
          </Card>

          {/* Statutory */}
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-4">Statutory Details</h3>
            <div className="space-y-3">
              {EDITABLE_FIELDS.slice(4, 7).map((field) => (
                <EditableRow
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={form[field] || ''}
                  editing={editing}
                  onChange={(v) => setForm({ ...form, [field]: v })}
                  original={(profile as any)[field] || ''}
                />
              ))}
            </div>
          </Card>

          {/* Bank */}
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-4">Bank Details</h3>
            <div className="space-y-3">
              {EDITABLE_FIELDS.slice(7).map((field) => (
                <EditableRow
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={form[field] || ''}
                  editing={editing}
                  onChange={(v) => setForm({ ...form, [field]: v })}
                  original={(profile as any)[field] || ''}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Change History */}
        {changeHistory.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-4">Change History</h3>
            <div className="space-y-3">
              {changeHistory.map((req) => (
                <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200">
                  {req.status === 'APPROVED' ? (
                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={req.status === 'APPROVED' ? 'success' : 'danger'}>
                        {req.status}
                      </Badge>
                      <span className="text-xs text-content-tertiary">
                        {new Date(req.reviewedAt || req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-content-secondary">
                      {Object.entries(req.changes as Record<string, { old: any; new: any }>).map(([f, v]) => (
                        <span key={f} className="mr-3">{FIELD_LABELS[f] || f}: {v.old || '—'} → {v.new || '—'}</span>
                      ))}
                    </div>
                    {req.reviewComment && (
                      <p className="mt-1 text-xs text-content-tertiary italic">"{req.reviewComment}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-content-tertiary">{label}</span>
      {badge ? (
        <Badge variant={value === 'ACTIVE' ? 'success' : 'default'} dot>{value}</Badge>
      ) : (
        <span className="text-sm font-medium text-content-primary">{value}</span>
      )}
    </div>
  );
}

function EditableRow({
  label, value, editing, onChange, original,
}: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; original: string;
}) {
  const changed = editing && value !== original;
  return (
    <div className="flex justify-between items-center py-1.5 gap-4">
      <span className="text-sm text-content-tertiary whitespace-nowrap">{label}</span>
      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`text-sm border rounded-md px-2.5 py-1.5 w-56 text-right ${changed ? 'border-brand-400 bg-brand-50' : 'border-surface-300 bg-white'}`}
        />
      ) : (
        <span className="text-sm font-medium text-content-primary">{value || '—'}</span>
      )}
    </div>
  );
}

