'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, PageSkeleton, PageHeader, EmptyState } from '../../../components/ui';
import { Landmark, ArrowUp, ArrowDown } from 'lucide-react';

export default function PortalPayStructurePage() {
  const { data: session } = useSession();
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const token = session?.session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<any>('/portal/my-pay-structure', { token });
      setAssignment(data || null);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: any) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-6">
        <PageHeader title="My Pay Structure" breadcrumbs={[{ label: 'Portal' }, { label: 'Pay Structure' }]} />

        {loading ? <PageSkeleton /> : !assignment ? (
          <Card>
            <EmptyState icon={<Landmark />} title="No pay structure assigned" description="Your administrator hasn't assigned a pay structure to you yet. Contact HR for details." />
          </Card>
        ) : (
          <>
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-content-primary">{assignment.template?.name || 'Pay Structure'}</h3>
                    <p className="text-xs text-content-tertiary">{assignment.template?.category} • Effective from {new Date(assignment.effectiveFrom).toLocaleDateString('en-IN')}</p>
                  </div>
                  <Badge variant="success" dot>Active</Badge>
                </div>

                {/* CTC Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-brand-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-brand-700">{fmt(assignment.ctcAnnual || 0)}</p>
                    <p className="text-xs text-brand-600">Annual CTC</p>
                  </div>
                  <div className="bg-success-light/30 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-success-dark">{fmt(assignment.ctcMonthly || (assignment.ctcAnnual ? assignment.ctcAnnual / 12 : 0))}</p>
                    <p className="text-xs text-success-dark">Monthly CTC</p>
                  </div>
                  <div className="bg-surface-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-content-primary">{fmt(assignment.grossMonthly || 0)}</p>
                    <p className="text-xs text-content-tertiary">Monthly Gross</p>
                  </div>
                </div>

                {/* Components */}
                {assignment.template?.components && assignment.template.components.length > 0 && (
                  <div className="border-t border-surface-100 pt-4">
                    <h4 className="text-sm font-semibold text-content-primary mb-3">Pay Components</h4>
                    <div className="space-y-2">
                      {assignment.template.components
                        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((comp: any) => (
                        <div key={comp.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50">
                          <div className="flex items-center gap-2">
                            {comp.head?.type === 'EARNING' ? (
                              <ArrowUp size={14} className="text-success-dark" />
                            ) : (
                              <ArrowDown size={14} className="text-danger" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-content-primary">{comp.head?.name || comp.name}</p>
                              <p className="text-xs text-content-tertiary font-mono">{comp.formula || 'Fixed'}</p>
                            </div>
                          </div>
                          <Badge variant={comp.head?.type === 'EARNING' ? 'success' : 'danger'}>
                            {comp.head?.type || 'EARNING'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
