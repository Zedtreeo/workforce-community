'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { GenerateInvoiceModal } from '../../components/generate-invoice-modal';
import { DuplicateInvoiceModal } from '../../components/duplicate-invoice-modal';
import {
  Button, StatCard, Badge, Select, Pagination, PageSkeleton,
  DataTable, TableToolbar, PageHeader,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { Plus, FileText, DollarSign, CheckCircle, AlertTriangle, Eye, Trash2, Mail, Copy } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: string;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
  client: { id: string; name: string; country: string };
  _count: { lineItems: number };
}

interface Stats {
  draft: { count: number; amount: number | string };
  sent: { count: number; amount: number | string };
  paid: { count: number; amount: number | string };
  overdue: { count: number; amount: number | string };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_BADGE_MAP: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'default',
  SENT: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'warning',
  VOID: 'danger',
};

const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const fmt = (amount: number | string) =>
  Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function InvoicesPage() {
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const limit = 15;

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This permanently removes it.`)) return;
    setDeletingId(inv.id);
    try {
      await apiFetch(`/invoices/${inv.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete invoice');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      sortable: true,
      render: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-mono text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
          {inv.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (inv) => <span className="text-content-primary">{inv.client.name}</span>,
    },
    {
      key: 'invoiceDate',
      header: 'Date',
      sortable: true,
      className: 'text-content-secondary text-xs',
      render: (inv) => <>{fmtDate(inv.invoiceDate)}</>,
    },
    {
      key: 'dueDate',
      header: 'Due',
      sortable: true,
      className: 'text-content-secondary text-xs',
      render: (inv) => <>{fmtDate(inv.dueDate)}</>,
    },
    {
      key: 'total',
      header: 'Total',
      headerClassName: 'text-right',
      className: 'text-right font-mono text-sm text-content-primary',
      render: (inv) => <>{inv.currency} {fmt(inv.total)}</>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => (
        <Badge variant={STATUS_BADGE_MAP[inv.status] ?? 'default'} dot>
          {inv.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (inv) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/invoices/${inv.id}`}>
            <Button variant="ghost" size="xs" icon={<Eye size={14} />}>View</Button>
          </Link>
          <Button
            variant="ghost"
            size="xs"
            icon={<Copy size={14} />}
            onClick={() => setDuplicateTarget(inv)}
          >
            Duplicate
          </Button>
          {(inv.status === 'DRAFT' || inv.status === 'CANCELLED') && (
            <Button
              variant="ghost"
              size="xs"
              icon={<Trash2 size={14} />}
              onClick={() => handleDelete(inv)}
              disabled={deletingId === inv.id}
              className="text-danger hover:text-danger"
            >
              {deletingId === inv.id ? '…' : 'Delete'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter) params.set('status', statusFilter);

      const [invoiceRes, statsRes] = await Promise.all([
        apiFetch<{ data: Invoice[]; meta: Meta }>(`/invoices?${params.toString()}`),
        apiFetch<Stats>('/invoices/stats'),
      ]);
      setInvoices(invoiceRes.data);
      setMeta(invoiceRes.meta);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [session, page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Invoices"
          description={meta ? `${meta.total} total invoices` : 'Loading...'}
          breadcrumbs={[{ label: 'Invoices' }]}
          actions={
            <div className="flex gap-2">
              <Link href="/invoices/email-template">
                <Button variant="secondary" icon={<Mail size={16} />}>Email & PDF Settings</Button>
              </Link>
              <Button icon={<Plus size={16} />} onClick={() => setShowGenerate(true)}>
                Generate Invoice
              </Button>
            </div>
          }
        />

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Draft" value={fmt(stats.draft.amount)} change={`${stats.draft.count} invoices`} changeType="neutral" icon={<FileText />} />
            <StatCard label="Outstanding" value={fmt(stats.sent.amount)} change={`${stats.sent.count} invoices`} changeType="neutral" icon={<DollarSign />} />
            <StatCard label="Collected" value={fmt(stats.paid.amount)} change={`${stats.paid.count} invoices`} changeType="positive" icon={<CheckCircle />} />
            <StatCard label="Overdue" value={fmt(stats.overdue.amount)} change={`${stats.overdue.count} invoices`} changeType="negative" icon={<AlertTriangle />} />
          </div>
        )}

        {/* Table */}
        <DataTable<Invoice>
          columns={columns}
          data={invoices}
          rowKey={(inv) => inv.id}
          loading={loading}
          loadingRows={limit}
          emptyMessage={
            statusFilter
              ? 'No invoices match this filter.'
              : 'No invoices yet. Generate your first invoice from a client with active assignments.'
          }
          emptyIcon={<FileText />}
          toolbar={
            <TableToolbar>
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              />
            </TableToolbar>
          }
          pagination={
            meta && (
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
            )
          }
        />

        {showGenerate && (
          <GenerateInvoiceModal
            onClose={() => setShowGenerate(false)}
            onSuccess={() => {
              setShowGenerate(false);
              fetchData();
            }}
          />
        )}

        {duplicateTarget && (
          <DuplicateInvoiceModal
            invoice={{
              id: duplicateTarget.id,
              invoiceNumber: duplicateTarget.invoiceNumber,
              currency: duplicateTarget.currency,
              total: duplicateTarget.total,
              client: duplicateTarget.client,
              lineCount: duplicateTarget._count?.lineItems,
            }}
            onClose={() => setDuplicateTarget(null)}
            onSuccess={() => setDuplicateTarget(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
