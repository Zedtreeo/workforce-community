'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import {
  Button, StatCard, Badge, Modal, Pagination, PageSkeleton,
  DataTable, Select, DatePicker, PageHeader,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { Plus, Clock, CheckCircle, XCircle, Ban, CalendarClock } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  leaveType: { name: string; code: string; isPaid: boolean };
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface LeaveStats {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  onLeaveToday: number;
  year: number;
}

interface Meta { total: number; page: number; limit: number; totalPages: number }
interface Employee { id: string; firstName: string; lastName: string; employeeCode: string }
interface LeaveType { id: string; name: string; code: string; isPaid: boolean; isActive: boolean; defaultDays: number }

const STATUS_BADGE_MAP: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function LeavesPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showApply, setShowApply] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [applyForm, setApplyForm] = useState({
    employeeId: '', leaveTypeId: '', startDate: '', endDate: '', days: 1, reason: '',
  });
  const [applyError, setApplyError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.session?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const [reqData, statsData] = await Promise.all([
        apiFetch<{ data: LeaveRequest[]; meta: Meta }>(`/leaves/requests?${params}`),
        apiFetch<LeaveStats>('/leaves/stats'),
      ]);
      setRequests(reqData.data);
      setMeta(reqData.meta);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch leave data:', err);
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openApplyModal = async () => {
    try {
      const [empData, typeData] = await Promise.all([
        apiFetch<{ data: Employee[] }>('/employees?status=ACTIVE&limit=500'),
        apiFetch<LeaveType[]>('/leaves/types'),
      ]);
      setEmployees(empData.data);
      setLeaveTypes(typeData.filter((t) => t.isActive));
      setApplyForm({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', days: 1, reason: '' });
      setApplyError('');
      setShowApply(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApply = async () => {
    setApplyError('');
    if (!applyForm.employeeId || !applyForm.leaveTypeId || !applyForm.startDate || !applyForm.endDate) {
      setApplyError('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/leaves/apply', {
        method: 'POST',
        body: JSON.stringify(applyForm),
      });
      setShowApply(false);
      fetchData();
    } catch (err: any) {
      setApplyError(err.message || 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (!confirm(`${status === 'APPROVED' ? 'Approve' : 'Reject'} this leave request?`)) return;
    try {
      await apiFetch(`/leaves/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to review');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await apiFetch(`/leaves/${id}/cancel`, { method: 'POST' });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (req) => (
        <div>
          <p className="font-medium text-content-primary">{req.employee.firstName} {req.employee.lastName}</p>
          <p className="text-xs text-content-tertiary">{req.employee.employeeCode}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (req) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="info">{req.leaveType.code}</Badge>
          <span className="text-content-tertiary text-xs">{req.leaveType.name}</span>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      className: 'text-content-secondary text-xs',
      render: (req) => <>{formatDate(req.startDate)} — {formatDate(req.endDate)}</>,
    },
    {
      key: 'days',
      header: 'Days',
      headerClassName: 'text-center',
      className: 'text-center font-medium text-content-primary',
      render: (req) => <>{parseFloat(req.days)}</>,
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'text-content-tertiary text-xs max-w-[200px] truncate',
      render: (req) => <>{req.reason || '—'}</>,
    },
    {
      key: 'status',
      header: 'Status',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (req) => <Badge variant={STATUS_BADGE_MAP[req.status]} dot>{req.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (req) => (
        <div className="flex items-center justify-end gap-1">
          {req.status === 'PENDING' && (
            <>
              <Button variant="success" size="xs" onClick={() => handleReview(req.id, 'APPROVED')}>Approve</Button>
              <Button variant="danger" size="xs" onClick={() => handleReview(req.id, 'REJECTED')}>Reject</Button>
            </>
          )}
          {(req.status === 'PENDING' || req.status === 'APPROVED') && (
            <Button variant="ghost" size="xs" onClick={() => handleCancel(req.id)}>Cancel</Button>
          )}
        </div>
      ),
    },
  ];

  const tabs = ['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Leave Management"
          description="Track and manage employee leave requests"
          breadcrumbs={[{ label: 'Leaves' }]}
          actions={
            <div className="flex items-center gap-2">
              <Link href="/leaves/types">
                <Button variant="secondary" size="sm">Leave Types</Button>
              </Link>
              <Link href="/leaves/balances">
                <Button variant="secondary" size="sm">Balances</Button>
              </Link>
              <Button icon={<Plus size={16} />} onClick={openApplyModal}>Apply Leave</Button>
            </div>
          }
        />

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Pending" value={stats.pending} icon={<Clock />} />
            <StatCard label={`Approved (${stats.year})`} value={stats.approved} changeType="positive" icon={<CheckCircle />} />
            <StatCard label={`Rejected (${stats.year})`} value={stats.rejected} changeType="negative" icon={<XCircle />} />
            <StatCard label={`Cancelled (${stats.year})`} value={stats.cancelled} icon={<Ban />} />
            <StatCard label="On Leave Today" value={stats.onLeaveToday} icon={<CalendarClock />} />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {tabs.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Table */}
        <DataTable<LeaveRequest>
          columns={columns}
          data={requests}
          rowKey={(req) => req.id}
          loading={loading}
          loadingRows={10}
          emptyMessage="No leave requests found"
          emptyIcon={<CalendarClock />}
          pagination={
            meta && (
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
            )
          }
        />
      </div>

      {/* Apply Leave Modal */}
      <Modal
        open={showApply}
        onClose={() => setShowApply(false)}
        title="Apply for Leave"
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button onClick={handleApply} loading={submitting}>Apply Leave</Button>
          </div>
        }
      >
        {applyError && (
          <div className="mb-4 p-3 bg-danger-light text-danger-dark rounded-lg text-sm">{applyError}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Employee</label>
            <select
              value={applyForm.employeeId}
              onChange={(e) => setApplyForm({ ...applyForm, employeeId: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Leave Type</label>
            <select
              value={applyForm.leaveTypeId}
              onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select leave type...</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code}) — {t.defaultDays} days/yr</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Start Date"
              value={applyForm.startDate}
              onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
            />
            <DatePicker
              label="End Date"
              value={applyForm.endDate}
              onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Number of Days</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={applyForm.days}
              onChange={(e) => setApplyForm({ ...applyForm, days: parseFloat(e.target.value) || 0 })}
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-content-tertiary mt-1">Use 0.5 for half-day leave</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">Reason (optional)</label>
            <textarea
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Reason for leave..."
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
