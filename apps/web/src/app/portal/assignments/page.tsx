'use client';

import { useEffect, useState } from 'react';

import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, PageSkeleton, PageHeader } from '../../../components/ui';
import { Briefcase } from 'lucide-react';

interface Assignment {
  id: string;
  clientName: string;
  clientCountry: string;
  role: string;
  workSchedule?: 'FULL_TIME' | 'PART_TIME';
  startDate: string;
  endDate: string | null;
  status: string;
}

export default function MyAssignmentsPage() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.session?.token) return;
    apiFetch<Assignment[]>('/portal/assignments', { token: session.session.token })
      .then(setAssignments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.session?.token]);

  const activeAssignments = assignments.filter((a) => a.status === 'ACTIVE');
  const pastAssignments = assignments.filter((a) => a.status !== 'ACTIVE');

  const statusVariant: Record<string, 'success' | 'default' | 'warning' | 'danger'> = {
    ACTIVE: 'success',
    COMPLETED: 'default',
    ENDED: 'danger',
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="My Assignments"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Assignments' }]}
        />

        {loading ? (
          <PageSkeleton />
        ) : assignments.length === 0 ? (
          <Card className="text-center">
            <div className="py-8">
              <Briefcase size={40} className="text-content-tertiary mx-auto mb-3" />
              <p className="text-content-tertiary">No assignments found</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Active Assignments */}
            {activeAssignments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-content-secondary mb-3">Current Assignments</h3>
                <div className="space-y-3">
                  {activeAssignments.map((a) => (
                    <Card key={a.id} hover>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-content-primary">{a.clientName}</h4>
                            <Badge variant="success" dot>{a.status}</Badge>
                          </div>
                          <p className="text-sm text-content-secondary">{a.role}</p>
                        </div>
                        <span className="text-sm text-content-tertiary">{a.clientCountry}</span>
                      </div>
                      <div className="flex gap-6 mt-3 pt-3 border-t border-surface-100 text-sm">
                        <div>
                          <span className="text-content-tertiary">Start Date: </span>
                          <span className="text-content-primary">{new Date(a.startDate).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-content-tertiary">End Date: </span>
                          <span className="text-content-primary font-medium">Current</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past Assignments */}
            {pastAssignments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-content-secondary mb-3">Past Assignments</h3>
                <Card padding="none">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-50 text-left border-b border-surface-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-content-secondary">Client</th>
                        <th className="px-4 py-3 font-medium text-content-secondary">Country</th>
                        <th className="px-4 py-3 font-medium text-content-secondary">Role</th>
                        <th className="px-4 py-3 font-medium text-content-secondary">Period</th>
                        <th className="px-4 py-3 font-medium text-content-secondary">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {pastAssignments.map((a) => (
                        <tr key={a.id} className="hover:bg-surface-50">
                          <td className="px-4 py-3 font-medium text-content-primary">{a.clientName}</td>
                          <td className="px-4 py-3 text-content-secondary">{a.clientCountry}</td>
                          <td className="px-4 py-3 text-content-secondary">{a.role}</td>
                          <td className="px-4 py-3 text-content-secondary">
                            {new Date(a.startDate).toLocaleDateString()} — {a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant[a.status] || 'default'}>
                              {a.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
