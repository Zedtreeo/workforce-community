'use client'

import { API_BASE } from '@/lib/api';

import { useEffect, useState } from 'react';

import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Modal, PageSkeleton, PageHeader } from '../../../components/ui';
import { TdsBreakdown } from '../../../components/tds-breakdown';

interface Payslip {
  id: string;
  month: number;
  year: number;
  basic: string; hra: string; da: string; specialAllow: string; otherAllow: string;
  grossEarnings: string;
  pfEmployee: string; esiEmployee: string; profTax: string; tds: string;
  totalDeductions: string;
  netPay: string;
  workingDays: number; paidDays: number; lopDays: number;
  tdsBreakdown?: any;
  employee?: { engagementType?: string };
}

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyPayslipsPage() {
  const { data: session } = useSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Payslip | null>(null);

  useEffect(() => {
    if (!session?.session?.token) return;
    setLoading(true);
    apiFetch<Payslip[]>(`/payroll/my-payslips?year=${year}`, { token: session.session.token })
      .then(setPayslips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.session?.token, year]);

  const downloadPdf = async (id: string) => {
    if (!session?.session?.token) return;
    const res = await fetch(`${API_BASE}/payroll/payslips/${id}/pdf`, {
      headers: { Authorization: `Bearer ${session.session.token}` },
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (v: string | number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="My Payslips"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Payslips' }]}
          actions={
            <select
              className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary"
              value={year}
              onChange={(e) => setYear(+e.target.value)}
            >
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : payslips.length === 0 ? (
          <Card className="text-center">
            <p className="py-4 text-content-tertiary">No payslips found for {year}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {payslips.map((p) => (
              <Card key={p.id} hover>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-content-primary">{monthNames[p.month]} {p.year}</h3>
                    <p className="text-xs text-content-tertiary mt-1">
                      {p.paidDays}/{p.workingDays} days paid
                      {p.lopDays > 0 && <span className="text-danger-dark ml-2">({p.lopDays} LOP)</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success-dark">{fmt(p.netPay)}</p>
                    <p className="text-xs text-content-tertiary">Gross: {fmt(p.grossEarnings)} — Ded: {fmt(p.totalDeductions)}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-surface-100">
                  <Button variant="ghost" size="xs" onClick={() => setDetail(p)}>View Breakdown</Button>
                  <Button variant="ghost" size="xs" onClick={() => downloadPdf(p.id)}>Download PDF</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${monthNames[detail.month]} ${detail.year}` : ''}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => detail && downloadPdf(detail.id)}>Download PDF</Button>
            <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Close</Button>
          </>
        }
      >
        {detail && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">Earnings</h4>
                <div className="space-y-1 text-sm">
                  {detail.employee?.engagementType === 'CONSULTANT' ? (
                    <div className="flex justify-between"><span className="text-content-secondary">Professional Fees</span><span className="text-content-primary">{fmt(detail.grossEarnings)}</span></div>
                  ) : (<>
                    <div className="flex justify-between"><span className="text-content-secondary">Basic</span><span className="text-content-primary">{fmt(detail.basic)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">HRA</span><span className="text-content-primary">{fmt(detail.hra)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">DA</span><span className="text-content-primary">{fmt(detail.da)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">Special Allow.</span><span className="text-content-primary">{fmt(detail.specialAllow)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">Other Allow.</span><span className="text-content-primary">{fmt(detail.otherAllow)}</span></div>
                  </>)}
                  <div className="flex justify-between font-semibold border-t border-surface-100 pt-1 mt-1"><span className="text-content-primary">Gross</span><span className="text-content-primary">{fmt(detail.grossEarnings)}</span></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">Deductions</h4>
                <div className="space-y-1 text-sm">
                  {detail.employee?.engagementType !== 'CONSULTANT' && <>
                    <div className="flex justify-between"><span className="text-content-secondary">PF</span><span className="text-content-primary">{fmt(detail.pfEmployee)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">ESI</span><span className="text-content-primary">{fmt(detail.esiEmployee)}</span></div>
                    <div className="flex justify-between"><span className="text-content-secondary">Prof. Tax</span><span className="text-content-primary">{fmt(detail.profTax)}</span></div>
                  </>}
                  <div className="flex justify-between"><span className="text-content-secondary">TDS{detail.employee?.engagementType === 'CONSULTANT' ? ' (2%)' : ''}</span><span className="text-content-primary">{fmt(detail.tds)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-surface-100 pt-1 mt-1 text-danger-dark"><span>Total</span><span>{fmt(detail.totalDeductions)}</span></div>
                </div>
              </div>
            </div>
            <TdsBreakdown data={detail.tdsBreakdown} />
            <div className="mt-4 pt-3 border-t border-surface-100 text-center">
              <p className="text-2xl font-bold text-success-dark">{fmt(detail.netPay)}</p>
            </div>
          </>
        )}
      </Modal>
    </DashboardLayout>
  );
}
