'use client'

import { API_BASE } from '@/lib/api';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton } from '../../../components/ui';
import { PaymentsTimelineCard } from '../../../components/invoicing/PaymentsTimelineCard';
import { LineItemsEditor } from '../../../components/invoicing/LineItemsEditor';
import { SendInvoiceEmailDialog } from '../../../components/invoicing/SendInvoiceEmailDialog';
import { DuplicateInvoiceModal } from '../../../components/duplicate-invoice-modal';
import { Mail, Copy } from 'lucide-react';


interface LineItem {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  assignment?: {
    id: string;
    employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  } | null;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
  notes?: string | null;
  paymentTerms?: string | null;
  payoneerLink?: string | null;
  paidAt?: string | null;
  paidAmount?: string | null;
  paymentRef?: string | null;
  billingEntityId?: string | null;
  billingEntity?: { id: string; name: string; invoicePrefix: string } | null;
  client: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    country: string;
    currency: string;
    billingEmail?: string | null;
    payoneerEmail?: string | null;
    contactNumber?: string | null;
    registeredAddress?: string | null;
  };
  lineItems: LineItem[];
}

interface BillingEntity {
  id: string;
  name: string;
  invoicePrefix: string;
  isDefault: boolean;
  isActive: boolean;
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'default',
  SENT: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'warning',
  VOID: 'danger',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [showEditPeriod, setShowEditPeriod] = useState(false);
  const [editPeriodStart, setEditPeriodStart] = useState('');
  const [editPeriodEnd, setEditPeriodEnd] = useState('');
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEntityId, setEditEntityId] = useState('');
  const [entities, setEntities] = useState<BillingEntity[]>([]);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<InvoiceDetail>(`/invoices/${id}`);
      setInvoice(data);
      setPayAmount(data.total);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    apiFetch<BillingEntity[]>('/invoices/billing-entities')
      .then((e) => setEntities(e.filter((x) => x.isActive)))
      .catch(() => {});
  }, []);

  const handleAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      await apiFetch(`/invoices/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await fetchInvoice();
      if (action === 'pay') setShowPayModal(false);
    } catch (err: any) {
      alert(err?.message ?? `Failed to ${action} invoice`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    await handleAction('cancel');
  };

  const openEditPeriod = () => {
    if (!invoice) return;
    setEditPeriodStart((invoice.periodStart || '').slice(0, 10));
    setEditPeriodEnd((invoice.periodEnd || '').slice(0, 10));
    setShowEditPeriod(true);
  };

  const openEditDetails = () => {
    if (!invoice) return;
    setEditInvoiceDate((invoice.invoiceDate || '').slice(0, 10));
    setEditDueDate((invoice.dueDate || '').slice(0, 10));
    setEditTerms(invoice.paymentTerms ?? '');
    setEditNotes(invoice.notes ?? '');
    setEditEntityId(invoice.billingEntityId ?? '');
    setShowEditDetails(true);
  };

  const saveDetails = async () => {
    if (!editInvoiceDate || !editDueDate) { alert('Pick both dates'); return; }
    setActionLoading('details');
    try {
      const body: any = {
        invoiceDate: editInvoiceDate,
        dueDate: editDueDate,
        paymentTerms: editTerms.trim() || undefined,
        notes: editNotes.trim() || undefined,
      };
      if (editEntityId && editEntityId !== (invoice?.billingEntityId ?? '')) {
        body.billingEntityId = editEntityId;
      }
      await apiFetch(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await fetchInvoice();
      setShowEditDetails(false);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update invoice details');
    } finally {
      setActionLoading(null);
    }
  };

  const savePeriod = async () => {
    if (!editPeriodStart || !editPeriodEnd) { alert('Pick both start and end dates'); return; }
    setActionLoading('period');
    try {
      await apiFetch(`/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ periodStart: editPeriodStart, periodEnd: editPeriodEnd }),
      });
      await fetchInvoice();
      setShowEditPeriod(false);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update period');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = () => {
    window.open(`${API_BASE}/invoices/${id}/pdf`, '_blank');
  };

  const fmt = (v: string | number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const isEditable = invoice ? !['PAID', 'CANCELLED', 'VOID'].includes(invoice.status) : false;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
          <PageSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-danger-dark">Invoice not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="max-w-4xl">
          <Link href="/invoices" className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1">
            ← Back to Invoices
          </Link>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-content-primary font-mono break-all">{invoice.invoiceNumber}</h1>
                <Badge variant={STATUS_BADGE_VARIANT[invoice.status]}>
                  {invoice.status}
                </Badge>
              </div>
              <p className="text-sm text-content-tertiary mt-1">
                <Link href={`/clients/${invoice.client.id}`} className="text-brand-600 hover:text-brand-700">
                  {invoice.client.name}
                </Link>
                {' · '}{invoice.client.country} · {invoice.paymentTerms ?? 'Due on Receipt'}
              </p>
              {invoice.billingEntity && (
                <p className="text-xs text-content-tertiary mt-0.5">Issued by <span className="font-medium text-content-secondary">{invoice.billingEntity.name}</span></p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
                Download PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowDuplicate(true)} className="gap-1.5">
                <Copy size={14} /> Duplicate
              </Button>
              {['DRAFT', 'SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(invoice.status) && (
                <Button size="sm" onClick={() => setEmailOpen(true)} className="gap-1.5">
                  {invoice.status === 'DRAFT' ? 'Send Email' : 'Resend Email'}
                </Button>
              )}
              {invoice.status === 'DRAFT' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAction('send')}
                    disabled={actionLoading === 'send'}
                    loading={actionLoading === 'send'}
                  >
                    {actionLoading === 'send' ? 'Sending...' : 'Mark as Sent'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              {invoice.status === 'SENT' && (
                <>
                  <Button variant="success" size="sm" onClick={() => setShowPayModal(true)}>
                    Record Payment
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-4">
            <p className="text-xs font-medium text-content-tertiary mb-1">BILL TO</p>
            <p className="text-sm font-semibold text-content-primary">{invoice.client.name}</p>
            {[invoice.client.firstName, invoice.client.lastName].filter(Boolean).length > 0 && (
              <p className="text-sm text-content-secondary">Attn: {[invoice.client.firstName, invoice.client.lastName].filter(Boolean).join(' ')}</p>
            )}
            {invoice.client.registeredAddress && (
              <p className="text-sm text-content-secondary whitespace-pre-line">{invoice.client.registeredAddress}</p>
            )}
            <p className="text-sm text-content-tertiary mt-1">
              {[invoice.client.contactNumber, invoice.client.billingEmail ?? invoice.client.email].filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <InfoCard label="Invoice Date" value={fmtDate(invoice.invoiceDate)} />
              {isEditable && (
                <button onClick={openEditDetails} className="absolute top-2 right-2 text-[11px] font-medium text-brand-600 hover:underline">Edit</button>
              )}
            </div>
            <div className="relative">
              <InfoCard label="Due Date" value={fmtDate(invoice.dueDate)} />
              {isEditable && (
                <button onClick={openEditDetails} className="absolute top-2 right-2 text-[11px] font-medium text-brand-600 hover:underline">Edit</button>
              )}
            </div>
            <div className="relative">
              <InfoCard label="Period" value={`${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}`} />
              {isEditable && (
                <button onClick={openEditPeriod} className="absolute top-2 right-2 text-[11px] font-medium text-brand-600 hover:underline">Edit</button>
              )}
            </div>
            <InfoCard label="Total" value={`${invoice.currency} ${fmt(invoice.total)}`} highlight />
          </div>

          {/* Payment terms */}
          <div className="mb-6 flex items-center gap-2 text-sm">
            <span className="text-content-tertiary">Payment terms:</span>
            <span className="font-medium text-content-primary">{invoice.paymentTerms ?? 'Due on Receipt'}</span>
            {isEditable && (
              <button onClick={openEditDetails} className="text-[11px] font-medium text-brand-600 hover:underline">Edit</button>
            )}
          </div>

          {/* Payment Info (if paid) */}
          {invoice.status === 'PAID' && invoice.paidAt && (
            <div className="bg-success-light border border-success rounded-xl p-4 mb-6">
              <p className="text-sm text-success-dark">
                <span className="font-semibold">Paid</span> on {fmtDate(invoice.paidAt)} —{' '}
                {invoice.currency} {fmt(invoice.paidAmount ?? invoice.total)}
                {invoice.paymentRef && <span className="font-mono text-xs ml-2">Ref: {invoice.paymentRef}</span>}
              </p>
            </div>
          )}

          {/* Line Items */}
          <LineItemsEditor
          invoiceId={invoice.id}
          invoiceCurrency={invoice.currency}
          invoiceStatus={invoice.status}
          onUpdated={fetchInvoice}
        />

          {/* Notes */}
          {(invoice.notes || isEditable) && (
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-content-tertiary font-medium">Notes</p>
                {isEditable && (
                  <button onClick={openEditDetails} className="text-[11px] font-medium text-brand-600 hover:underline">Edit</button>
                )}
              </div>
              <p className="text-sm text-content-secondary whitespace-pre-line">
                {invoice.notes || <span className="text-content-tertiary italic">No notes — click Edit to add.</span>}
              </p>
            </Card>
          )}

          {/* Payment Modal */}
          <Modal
            open={showPayModal}
            onClose={() => setShowPayModal(false)}
            title="Record Payment"
            description={`${invoice.invoiceNumber} — ${invoice.currency} ${fmt(invoice.total)}`}
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowPayModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  loading={actionLoading === 'pay'}
                  onClick={() => handleAction('pay', { paidAmount: payAmount, paymentRef: payRef.trim() || undefined })}
                >
                  {actionLoading === 'pay' ? 'Recording...' : 'Confirm Payment'}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Amount Received *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Payment Reference (Payoneer TXN ID)</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="PAY-TXN-123456"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
            </div>
          </Modal>

          <Modal
            open={showEditDetails}
            onClose={() => setShowEditDetails(false)}
            title="Edit Invoice Details"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowEditDetails(false)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={actionLoading === 'details'} onClick={saveDetails}>Save</Button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Invoice date</label>
                  <input type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Due date</label>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>
              {entities.length > 1 && (
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Issued by (company)</label>
                  <select value={editEntityId} onChange={(e) => setEditEntityId(e.target.value)} className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {entities.map((en) => (
                      <option key={en.id} value={en.id}>{en.name} ({en.invoicePrefix})</option>
                    ))}
                  </select>
                  {editEntityId && editEntityId !== (invoice?.billingEntityId ?? '') && (
                    <p className="text-[11px] text-warning-dark mt-1">Changing the company will renumber this invoice into that company's series.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm text-content-secondary mb-1">Payment terms</label>
                <input
                  list="payment-terms-presets"
                  value={editTerms}
                  onChange={(e) => setEditTerms(e.target.value)}
                  placeholder="e.g. Payment in Advance"
                  className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <datalist id="payment-terms-presets">
                  <option value="Payment in Advance" />
                  <option value="Due on Receipt" />
                  <option value="Net 7" />
                  <option value="Net 15" />
                  <option value="Net 30" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm text-content-secondary mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Shown on the invoice PDF"
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <p className="text-xs text-content-tertiary">Changes update the invoice record and its PDF. Totals and line items are not affected.</p>
            </div>
          </Modal>

          <Modal
            open={showEditPeriod}
            onClose={() => setShowEditPeriod(false)}
            title="Edit Invoice Period"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowEditPeriod(false)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={actionLoading === 'period'} onClick={savePeriod}>Save</Button>
              </>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-content-secondary mb-1">Period start</label>
                <input type="date" value={editPeriodStart} onChange={(e) => setEditPeriodStart(e.target.value)} className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-content-secondary mb-1">Period end</label>
                <input type="date" value={editPeriodEnd} onChange={(e) => setEditPeriodEnd(e.target.value)} className="w-full h-10 rounded-lg border border-surface-300 px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <p className="text-xs text-content-tertiary">Updates the “Period” shown on the invoice PDF. Doesn’t change line items or amounts.</p>
            </div>
          </Modal>
        </div>
        <PaymentsTimelineCard
          invoiceId={invoice.id}
          invoiceCurrency={invoice.currency}
          invoiceTotal={Number(invoice.total)}
          invoiceStatus={invoice.status}
          canWrite={true}
          onUpdated={fetchInvoice}
        />

        <SendInvoiceEmailDialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          defaultRecipient={invoice.client?.billingEmail ?? invoice.client?.email}
          defaultPayoneerLink={invoice.payoneerLink ?? undefined}
          onSent={fetchInvoice}
        />

        {showDuplicate && (
          <DuplicateInvoiceModal
            invoice={{
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              currency: invoice.currency,
              total: invoice.total,
              client: invoice.client,
              lineCount: invoice.lineItems?.length,
            }}
            onClose={() => setShowDuplicate(false)}
          />
        )}

      </div>
    </DashboardLayout>
  );
}

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'bg-brand-50 border-brand-200' : ''}>
      <p className="text-xs text-content-tertiary mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-brand-900' : 'text-content-primary'}`}>{value}</p>
    </Card>
  );
}
