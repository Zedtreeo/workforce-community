'use client'

import { API_BASE } from '@/lib/api';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton } from '../../../components/ui';
import { TdsBreakdown } from '../../../components/tds-breakdown';

interface Payslip {
  id: string;
  employeeId: string;
  employee: { firstName: string; lastName: string; employeeCode: string; designation: string | null; engagementType?: string };
  month: number;
  year: number;
  basic: string; hra: string; da: string; specialAllow: string; otherAllow: string;
  grossEarnings: string;
  pfEmployee: string; esiEmployee: string; profTax: string; tds: string;
  otherDeductions: string; totalDeductions: string;
  netPay: string;
  workingDays: number; paidDays: number; lopDays: number;
  tdsBreakdown?: any;
}

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayslipsPage() {
  return (
    <Suspense fallback={<DashboardLayout><PageSkeleton /></DashboardLayout>}>
      <PayslipsContent />
    </Suspense>
  );
}

function PayslipsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const qMonth = searchParams.get('month');
  const qYear = searchParams.get('year');

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Payslip | null>(null);

  const load = useCallback(async () => {
    if (!session?.session?.token) return;
    const params = new URLSearchParams();
    if (qMonth) params.set('month', qMonth);
    if (qYear) params.set('year', qYear);
    try {
      const data = await apiFetch<Payslip[]>(`/payroll/payslips?${params}`, { token: session.session.token });
      setPayslips(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session?.session?.token, qMonth, qYear]);

  useEffect(() => { load(); }, [load]);

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

  const period = qMonth && qYear ? `${monthNames[+qMonth]} ${qYear}` : 'All';

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/payroll" className="text-sm text-content-tertiary hover:text-content-secondary">&larr; Payroll</Link>
          <h1 className="text-2xl font-bold text-content-primary">Payslips — {period}</h1>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : payslips.length === 0 ? (
          <Card className="p-8 text-center text-content-tertiary">No payslips found</Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-content-secondary">Employee</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Gross</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Deductions</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Net Pay</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Days</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">LOP</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-content-primary">{p.employee.firstName} {p.employee.lastName}</p>
                      <p className="text-xs text-content-tertiary">{p.employee.employeeCode} &middot; {p.employee.designation || '—'}</p>
                    </td>
                    <td className="px-4 py-3">{fmt(p.grossEarnings)}</td>
                    <td className="px-4 py-3 text-danger-dark">{fmt(p.totalDeductions)}</td>
                    <td className="px-4 py-3 font-semibold text-success-dark">{fmt(p.netPay)}</td>
                    <td className="px-4 py-3">{p.paidDays}/{p.workingDays}</td>
                    <td className="px-4 py-3">
                      {p.lopDays > 0 ? <span className="text-danger-dark font-medium">{p.lopDays}</span> : <span className="text-content-tertiary">0</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="xs" onClick={() => setDetail(p)}>View</Button>
                        <Button variant="ghost" size="xs" onClick={() => downloadPdf(p.id)}>PDF</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.employee.firstName} ${detail.employee.lastName} — ${monthNames[detail.month]} ${detail.year}` : ''}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="secondary" onClick={() => downloadPdf(detail.id)}>Download PDF</Button>
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
            </>
          ) : null
        }
      >
        {detail && (
          <>
            <p className="text-xs text-content-tertiary mb-4">{detail.employee.employeeCode} &middot; Working: {detail.paidDays}/{detail.workingDays} days {detail.lopDays > 0 ? `(${detail.lopDays} LOP)` : ''}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">Earnings</h4>
                <div className="space-y-1 text-sm">
                  {detail.employee.engagementType === 'CONSULTANT' ? (
                    <div className="flex justify-between"><span>Professional Fees</span><span>{fmt(detail.grossEarnings)}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between"><span>Basic</span><span>{fmt(detail.basic)}</span></div>
                      <div className="flex justify-between"><span>HRA</span><span>{fmt(detail.hra)}</span></div>
                      <div className="flex justify-between"><span>DA</span><span>{fmt(detail.da)}</span></div>
                      <div className="flex justify-between"><span>Special Allow.</span><span>{fmt(detail.specialAllow)}</span></div>
                      <div className="flex justify-between"><span>Other Allow.</span><span>{fmt(detail.otherAllow)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between font-semibold border-t border-surface-200 pt-1 mt-1">
                    <span>Gross</span><span>{fmt(detail.grossEarnings)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">Deductions</h4>
                <div className="space-y-1 text-sm">
                  {detail.employee.engagementType !== 'CONSULTANT' && <>
                    <div className="flex justify-between"><span>PF</span><span>{fmt(detail.pfEmployee)}</span></div>
                    <div className="flex justify-between"><span>ESI</span><span>{fmt(detail.esiEmployee)}</span></div>
                    <div className="flex justify-between"><span>Prof. Tax</span><span>{fmt(detail.profTax)}</span></div>
                  </>}
                  <div className="flex justify-between"><span>TDS{detail.employee.engagementType === 'CONSULTANT' ? ' (2%)' : ''}</span><span>{fmt(detail.tds)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-surface-200 pt-1 mt-1 text-danger-dark">
                    <span>Total</span><span>{fmt(detail.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            <TdsBreakdown data={detail.tdsBreakdown} />

            <div className="mt-4 pt-3 border-t border-surface-200 text-center">
              <p className="text-xs text-content-tertiary">Net Pay</p>
              <p className="text-2xl font-bold text-success-dark">{fmt(detail.netPay)}</p>
            </div>
          </>
        )}
      </Modal>
    </DashboardLayout>
  );
}
