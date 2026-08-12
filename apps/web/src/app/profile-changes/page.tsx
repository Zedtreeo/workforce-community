'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton, PageHeader } from '../../components/ui';
import { Check, X, Eye, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface ProfileChange {
  id: string;
  employeeId: string;
  requestedBy: string;
  changes: Record<string, { old: string | null; new: string | null }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode: string | null;
    department?: { name: string } | null;
  };
}

const fieldLabels: Record<string, string> = {
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

const statusConfig = {
  PENDING: { variant: 'warning' as const, icon: <Clock size={14} />, label: 'Pending' },
  APPROVED: { variant: 'success' as const, icon: <CheckCircle2 size={14} />, label: 'Approved' },
  REJECTED: { variant: 'danger' as const, icon: <XCircle size={14} />, label: 'Rejected' },
};

export default function ProfileChangesPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<ProfileChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<ProfileChange | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const params = filter === 'PENDING' ? '?status=PENDING' : '';
      const data = await apiFetch<{ data: ProfileChange[]; total: number }>(
        `/profile-changes${params}`,
        { token: session.session.token }
      );
      setRequests(data.data || []);
    } catch (e) {
      console.error('Failed to load profile changes:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.session?.token, filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (id: string) => {
    if (!session?.session?.token) return;
    setProcessing(true);
    try {
      await apiFetch(`/profile-changes/${id}/approve`, {
        method: 'PATCH',
        token: session.session.token,
      });
      setSelectedRequest(null);
      loadRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!session?.session?.token) return;
    setProcessing(true);
    try {
      await apiFetch(`/profile-changes/${id}/reject`, {
        method: 'PATCH',
        token: session.session.token,
        body: JSON.stringify({ comment: rejectComment }),
      });
      setSelectedRequest(null);
      setRejectComment('');
      loadRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Profile Change Requests"
          breadcrumbs={[{ label: 'Profile Changes' }]}
        />

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {(['PENDING', 'ALL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setLoading(true); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                filter === f
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {f === 'PENDING' ? 'Pending Review' : 'All Requests'}
              {f === 'PENDING' && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-warning-light text-warning-dark rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Requests list */}
        {requests.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-8">
              <CheckCircle2 size={40} className="mx-auto text-success-dark mb-3 opacity-50" />
              <p className="text-content-secondary font-medium">No {filter === 'PENDING' ? 'pending' : ''} profile change requests</p>
              <p className="text-sm text-content-tertiary mt-1">
                {filter === 'PENDING' ? 'All requests have been reviewed.' : 'No requests have been submitted yet.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const changeCount = Object.keys(req.changes).length;
              const config = statusConfig[req.status];
              return (
                <Card key={req.id} padding="none">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-semibold text-sm">
                        {req.employee.firstName?.[0]}{req.employee.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-content-primary">
                          {req.employee.firstName} {req.employee.lastName}
                          {req.employee.employeeCode && (
                            <span className="text-content-tertiary font-normal ml-2 text-xs">
                              #{req.employee.employeeCode}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-content-tertiary mt-0.5">
                          {changeCount} field{changeCount !== 1 ? 's' : ''} changed &middot; {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={config.variant} dot>
                        {config.label}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye />}
                        onClick={() => setSelectedRequest(req)}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        open={!!selectedRequest}
        onClose={() => { setSelectedRequest(null); setRejectComment(''); }}
        title="Review Profile Changes"
        description={selectedRequest ? `${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName}` : ''}
        footer={
          selectedRequest?.status === 'PENDING' ? (
            <>
              <Button variant="secondary" onClick={() => { setSelectedRequest(null); setRejectComment(''); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<X />}
                onClick={() => handleReject(selectedRequest.id)}
                loading={processing}
              >
                Reject
              </Button>
              <Button
                icon={<Check />}
                onClick={() => handleApprove(selectedRequest.id)}
                loading={processing}
              >
                Approve
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
              Close
            </Button>
          )
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            {/* Changes diff */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">Requested Changes</p>
              {Object.entries(selectedRequest.changes).map(([field, values]) => (
                <div key={field} className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-content-tertiary mb-1">{fieldLabels[field] || field}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-content-secondary line-through truncate">{values.old || '(empty)'}</span>
                      <ArrowRight size={14} className="text-content-tertiary shrink-0" />
                      <span className="text-content-primary font-medium truncate">{values.new || '(empty)'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Meta info */}
            <div className="text-xs text-content-tertiary space-y-1 pt-2 border-t border-surface-200">
              <p>Submitted: {new Date(selectedRequest.createdAt).toLocaleString('en-IN')}</p>
              {selectedRequest.reviewedAt && (
                <p>Reviewed: {new Date(selectedRequest.reviewedAt).toLocaleString('en-IN')}</p>
              )}
              {selectedRequest.reviewComment && (
                <p className="text-content-secondary">Comment: {selectedRequest.reviewComment}</p>
              )}
            </div>

            {/* Reject comment */}
            {selectedRequest.status === 'PENDING' && (
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  Rejection reason (optional)
                </label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Reason for rejection..."
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
