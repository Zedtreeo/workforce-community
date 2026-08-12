'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { downloadCSV } from '../../../lib/csv-export';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader } from '../../../components/ui';

interface ClientBilling {
  client: { id: string; name: string; country: string; currency: string };
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  currency: string;
}

interface InvoiceRow {
  id: string; invoiceNumber: string; clientName: string; invoiceDate: string;
  dueDate: string; total: number; currency: string; status: string; paidAt: string | null;
}

interface BillingData {
  year: number;
  clients: ClientBilling[];
  grandTotal: { totalBilled: number; totalPaid: number; totalOutstanding: number; invoiceCount: number };
  invoices: InvoiceRow[];
}

export default function BillingReportPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchReport = useCallback(async () => {
    if (!session?.session?.id) return;
    setLoading(true);
    try {
      const result = await apiFetch<BillingData>(`/reports/billing?year=${year}`);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    if (!data) return;
    downloadCSV(
      data.clients.map((c) => ({
        Client: c.client.name,
        Country: c.client.country,
        Currency: c.currency,
        Invoices: c.invoiceCount,
        'Total Billed': c.totalBilled,
        'Total Paid': c.totalPaid,
        Outstanding: c.totalOutstanding,
      })),
      `billing-summary-${year}`,
    );
  };

  const fmt = (n: number, cur?: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 0 }).format(n);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Client Billing Summary"
          breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Billing' }]}
          actions={
            <div className="flex items-center gap-3">
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button onClick={fetchReport}>Generate</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={!data || data.clients.length === 0}>Export CSV</Button>
            </div>
          }
        />

        {loading ? (
          <div className="text-center py-12 text-content-tertiary">Generating report...</div>
        ) : !data || data.clients.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary">No billing data for {year}</div>
        ) : (
          <>
            {/* Grand Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-content-tertiary">Total Invoices</p>
                <p className="text-2xl font-bold mt-1 text-content-primary">{data.grandTotal.invoiceCount}</p>
              </Card>
              <Card>
                <p className="text-sm text-content-tertiary">Total Billed</p>
                <p className="text-2xl font-bold mt-1 text-content-primary">{fmt(data.grandTotal.totalBilled)}</p>
              </Card>
              <Card>
                <p className="text-sm text-content-tertiary">Collected</p>
                <p className="text-2xl font-bold mt-1 text-success-dark">{fmt(data.grandTotal.totalPaid)}</p>
              </Card>
              <Card>
                <p className="text-sm text-content-tertiary">Outstanding</p>
                <p className="text-2xl font-bold mt-1 text-danger-dark">{fmt(data.grandTotal.totalOutstanding)}</p>
              </Card>
            </div>

            {/* Client Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Country</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Invoices</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Billed</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Paid</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((c) => (
                    <tr key={c.client.id} className="border-b border-surface-100 hover:bg-surface-50">
                      <td className="px-5 py-3 font-medium text-content-primary whitespace-nowrap">{c.client.name}</td>
                      <td className="px-5 py-3 text-content-secondary">{c.client.country}</td>
                      <td className="px-5 py-3 text-center">{c.invoiceCount}</td>
                      <td className="px-5 py-3 text-right font-medium whitespace-nowrap">{fmt(c.totalBilled, c.currency)}</td>
                      <td className="px-5 py-3 text-right text-success-dark whitespace-nowrap">{fmt(c.totalPaid, c.currency)}</td>
                      <td className="px-5 py-3 text-right text-danger-dark font-medium whitespace-nowrap">{fmt(c.totalOutstanding, c.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
