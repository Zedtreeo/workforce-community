'use client';

import { useEffect, useState } from 'react';

import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, Button, Modal, PageSkeleton, PageHeader } from '../../../components/ui';
import { Plus } from 'lucide-react';

interface LeaveRequest {
  id: string;
  leaveType: string;
  leaveCode: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

interface LeaveBalance {
  type: string;
  code: string;
  entitled: number;
  used: number;
  available: number;
}

interface LeaveData {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

const statusBadgeVariant: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

const fmtLeave = (n: number) => (Number.isInteger(n) ? `${n}` : `${+(+n).toFixed(2)}`);

export default function MyLeavesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<LeaveData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Apply leave modal state
  const [showApply, setShowApply] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    days: 1,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const fetchLeaves = () => {
    if (!session?.session?.token) return;
    setLoading(true);
    apiFetch<LeaveData>(`/portal/leaves?year=${year}`, { token: session.session.token })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaves();
  }, [session?.session?.token, year]);

  const openApplyModal = () => {
    if (!session?.session?.token) return;
    apiFetch<LeaveType[]>('/portal/leave-types', { token: session.session.token })
      .then((types) => {
        setLeaveTypes(types);
        setApplyForm({ leaveTypeId: types[0]?.id || '', startDate: '', endDate: '', days: 1, reason: '' });
        setShowApply(true);
      })
      .catch(() => setAlert({ type: 'danger', message: 'Failed to load leave types' }));
  };

  const handleApplySubmit = async () => {
    if (!session?.session?.token) return;
    setSubmitting(true);
    setAlert(null);
    try {
      await apiFetch('/portal/leaves/apply', {
        token: session.session.token,
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: applyForm.leaveTypeId,
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          days: applyForm.days,
          reason: applyForm.reason,
        }),
      });
      setShowApply(false);
      setAlert({ type: 'success', message: 'Leave request submitted successfully' });
      fetchLeaves();
    } catch {
      setAlert({ type: 'danger', message: 'Failed to submit leave request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="My Leaves"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Leaves' }]}
          actions={
            <>
              <select
                className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
                value={year}
                onChange={(e) => setYear(+e.target.value)}
              >
                {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button size="sm" icon={<Plus size={16} />} onClick={openApplyModal}>
                Apply Leave
              </Button>
            </>
          }
        />

        {/* Alert */}
        {alert && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
            alert.type === 'success' ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
          }`}>
            {alert.message}
          </div>
        )}

        {loading ? (
          <PageSkeleton />
        ) : data ? (
          <>
            {/* Balances */}
            {data.balances.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-content-secondary mb-3">Balances — {year}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.balances.map((b) => (
                    <Card key={b.code} padding="sm">
                      <p className="text-xs text-content-tertiary mb-1">{b.type}</p>
                      <p className="text-2xl font-bold text-content-primary">{fmtLeave(b.available)}</p>
                      <div className="mt-2 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${b.entitled > 0 ? Math.min(100, (b.used / b.entitled) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-content-tertiary mt-1">{fmtLeave(b.used)} / {fmtLeave(b.entitled)} used</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Requests */}
            <div>
              <h3 className="text-sm font-semibold text-content-secondary mb-3">Requests — {year}</h3>
              <Card padding="none">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-left border-b border-surface-200">
                    <tr>
                      <th className="px-4 py-3 font-medium text-content-secondary">Type</th>
                      <th className="px-4 py-3 font-medium text-content-secondary">Dates</th>
                      <th className="px-4 py-3 font-medium text-content-secondary">Days</th>
                      <th className="px-4 py-3 font-medium text-content-secondary">Reason</th>
                      <th className="px-4 py-3 font-medium text-content-secondary">Status</th>
                      <th className="px-4 py-3 font-medium text-content-secondary">Review Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {data.requests.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-50">
                        <td className="px-4 py-2 font-medium text-content-primary">{r.leaveType}</td>
                        <td className="px-4 py-2 text-content-secondary">
                          {new Date(r.startDate).toLocaleDateString()} — {new Date(r.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-content-primary">{r.days}</td>
                        <td className="px-4 py-2 text-content-tertiary max-w-[150px] truncate">{r.reason || '—'}</td>
                        <td className="px-4 py-2">
                          <Badge variant={statusBadgeVariant[r.status] || 'default'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-content-tertiary text-xs">{r.reviewNote || '—'}</td>
                      </tr>
                    ))}
                    {data.requests.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">No leave requests for {year}</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-content-tertiary text-sm">No data available</p>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        open={showApply}
        onClose={() => setShowApply(false)}
        title="Apply for Leave"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={submitting}
              disabled={!applyForm.leaveTypeId || !applyForm.startDate || !applyForm.endDate}
              onClick={handleApplySubmit}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Leave Type</label>
            <select
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
              value={applyForm.leaveTypeId}
              onChange={(e) => setApplyForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Start Date</label>
              <input
                type="date"
                className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
                value={applyForm.startDate}
                onChange={(e) => setApplyForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
                value={applyForm.endDate}
                onChange={(e) => setApplyForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Number of Days</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
              value={applyForm.days}
              onChange={(e) => setApplyForm((f) => ({ ...f, days: parseFloat(e.target.value) || 1 }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Reason</label>
            <textarea
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0 min-h-[80px] resize-none"
              placeholder="Reason for leave..."
              value={applyForm.reason}
              onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
