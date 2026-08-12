'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, PageSkeleton, PageHeader, EmptyState } from '../../../components/ui';
import { Clock, Calendar } from 'lucide-react';

export default function PortalShiftPage() {
  const { data: session } = useSession();
  const [shift, setShift] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [empId, setEmpId] = useState<string | null>(null);

  const token = session?.session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      // Get employee profile to get ID
      const profile = await apiFetch<any>('/portal/me', { token });
      const eid = profile?.employee?.id || profile?.id;
      if (!eid) return;
      setEmpId(eid);

      const [current, hist] = await Promise.all([
        apiFetch<any>(`/shifts/employee/${eid}`, { token }).catch(() => null),
        apiFetch<any[]>(`/shifts/employee/${eid}/history`, { token }).catch(() => []),
      ]);
      setShift(current);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-6">
        <PageHeader title="My Shift" breadcrumbs={[{ label: 'Portal' }, { label: 'Shift' }]} />

        {loading ? <PageSkeleton /> : !shift ? (
          <Card>
            <EmptyState icon={<Clock />} title="No shift assigned" description="Your administrator hasn't assigned a shift to you yet." />
          </Card>
        ) : (
          <>
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-content-primary">{shift.shiftType?.name || 'Current Shift'}</h3>
                  <Badge variant="success" dot>Active</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-content-tertiary">Code</p>
                    <p className="text-sm font-medium font-mono">{shift.shiftType?.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Timing</p>
                    <p className="text-sm font-medium">{shift.shiftType?.startTime} – {shift.shiftType?.endTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Working Hours</p>
                    <p className="text-sm font-medium">{Number(shift.shiftType?.workingHours || 8)}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Lunch Break</p>
                    <p className="text-sm font-medium">{shift.shiftType?.lunchBreakMinutes || 60} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Grace Period</p>
                    <p className="text-sm font-medium">{shift.shiftType?.graceMinutes || 15} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Effective From</p>
                    <p className="text-sm font-medium">{new Date(shift.effectiveFrom).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                {shift.shiftType?.description && (
                  <p className="text-sm text-content-tertiary mt-3 border-t border-surface-100 pt-3">{shift.shiftType.description}</p>
                )}
              </div>
            </Card>

            {history.length > 1 && (
              <Card>
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-content-primary mb-3">Shift History</h3>
                  <div className="space-y-2">
                    {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-content-tertiary" />
                          <div>
                            <p className="text-sm font-medium">{h.shiftType?.name}</p>
                            <p className="text-xs text-content-tertiary">
                              {new Date(h.effectiveFrom).toLocaleDateString('en-IN')}
                              {h.effectiveTo && ` – ${new Date(h.effectiveTo).toLocaleDateString('en-IN')}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant={h.isActive ? 'success' : 'default'}>
                          {h.isActive ? 'Current' : 'Past'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
