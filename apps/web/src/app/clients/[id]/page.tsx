'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { AssignmentModal } from '../../../components/assignment-modal';
import { GenerateInvoiceModal } from '../../../components/generate-invoice-modal';
import { Button, Card, Badge, Modal, PageSkeleton } from '../../../components/ui';
import { LettersCard } from '../../../components/letters/LettersCard';

interface Assignment {
  id: string;
  role?: string | null;
  startDate: string;
  endDate?: string | null;
  billingRate: string;
  currency: string;
  billingCycle: string;
  workSchedule: 'FULL_TIME' | 'PART_TIME';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  notes?: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation?: string | null;
    email?: string;
  };
}

interface ClientDetail {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  country: string;
  currency: string;
  billingEmail?: string | null;
  payoneerEmail?: string | null;
  website?: string | null;
  registeredAddress?: string | null;
  signatoryName?: string | null;
  contactNumber?: string | null;
  billingEntityId?: string | null;
  billingEntity?: { id: string; name: string; invoicePrefix: string } | null;
  isActive: boolean;
  createdAt: string;
  assignments?: Assignment[];
}

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'default' | 'danger' | 'warning'> = {
  ACTIVE: 'success',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  ON_HOLD: 'warning',
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [portalAccess, setPortalAccess] = useState<{ portalEnabled: boolean; email: string; lastLoginAt: string | null } | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [entities, setEntities] = useState<{ id: string; name: string; invoicePrefix: string; isDefault: boolean; isActive: boolean }[]>([]);
  const [savingEntity, setSavingEntity] = useState(false);

  useEffect(() => {
    apiFetch<{ id: string; name: string; invoicePrefix: string; isDefault: boolean; isActive: boolean }[]>('/invoices/billing-entities')
      .then((e) => setEntities(e.filter((x) => x.isActive)))
      .catch(() => {});
  }, []);

  const changeBillingEntity = async (billingEntityId: string) => {
    setSavingEntity(true);
    try {
      await apiFetch(`/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ billingEntityId: billingEntityId || null }),
      });
      await fetchData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to change billing company');
    } finally {
      setSavingEntity(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientData, assignmentData] = await Promise.all([
        apiFetch<ClientDetail>(`/clients/${id}`),
        apiFetch<{ data: Assignment[] }>(`/assignments?clientId=${id}&limit=100`),
      ]);
      setClient(clientData);
      setAssignments(assignmentData.data);
      apiFetch<any>(`/client-portal/access/${id}`).then(setPortalAccess).catch(() => {});
    } catch (err) {
      console.error('Failed to load client:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateInvoice = async (assignmentId: string) => {
    setInvoicingId(assignmentId);
    try {
      const inv = await apiFetch<{ id: string; invoiceNumber: string }>(
        `/invoices/generate-for-assignment`,
        { method: 'POST', body: JSON.stringify({ assignmentId }) },
      );
      router.push(`/invoices/${inv.id}`);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to generate invoice');
    } finally {
      setInvoicingId(null);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    if (!confirm('End this assignment? Employee will become available for reassignment.')) return;
    setEndingId(assignmentId);
    try {
      await apiFetch(`/assignments/${assignmentId}/end`, {
        method: 'POST',
        body: JSON.stringify({
          endDate: new Date().toISOString().split('T')[0],
          status: 'COMPLETED',
        }),
      });
      await fetchData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to end assignment');
    } finally {
      setEndingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    try {
      await apiFetch(`/clients/${id}`, { method: 'DELETE' });
      router.push('/clients');
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete. Client may have active assignments.');
    }
  };

  const handleTogglePortal = async (enabled: boolean) => {
    setPortalBusy(true);
    try {
      const res = await apiFetch<{ portalEnabled: boolean; email: string }>(`/client-portal/access/${id}`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      setPortalAccess((prev) => ({ lastLoginAt: prev?.lastLoginAt ?? null, portalEnabled: res.portalEnabled, email: res.email }));
    } catch (err: any) {
      alert(err.message || 'Failed to update portal access');
    } finally {
      setPortalBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
          <PageSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-danger-dark">Client not found.</div>
      </DashboardLayout>
    );
  }

  const active = assignments.filter((a) => a.status === 'ACTIVE');
  const past = assignments.filter((a) => a.status !== 'ACTIVE');

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <Link href="/clients" className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1">
          ← Back to Clients
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-content-primary">{client.name}</h1>
              <Badge variant={client.isActive ? 'success' : 'default'} dot>
                {client.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-content-tertiary mt-1">
              {client.country} · {client.currency} · Client since{' '}
              {new Date(client.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex gap-2">
            {active.length > 0 && (
              <Button variant="success" size="sm" onClick={() => setShowInvoiceModal(true)}>
                Generate Invoice
              </Button>
            )}
            <Link href={`/clients/${id}/edit`}>
              <Button variant="secondary" size="sm">Edit</Button>
            </Link>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            label="Contact Name"
            value={[client.firstName, client.lastName].filter(Boolean).join(' ') || null}
          />
          <InfoCard label="Primary Email" value={client.email} />
          <InfoCard label="Contact Number" value={client.contactNumber} />
          <InfoCard label="Billing Email" value={client.billingEmail} />
          <InfoCard label="Website" value={client.website} />
          <div className="md:col-span-3">
            <InfoCard label="Address" value={client.registeredAddress} />
          </div>
        </div>

        {/* Billing company (which legal entity invoices this client) */}
        {entities.length > 1 && (
          <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-4">
            <p className="text-xs font-medium text-content-tertiary mb-1">Billed by (invoicing company)</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                value={client.billingEntityId ?? ''}
                onChange={(e) => changeBillingEntity(e.target.value)}
                disabled={savingEntity}
                className="h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-xs"
              >
                <option value="">Default company{entities.find((x) => x.isDefault) ? ` (${entities.find((x) => x.isDefault)!.name})` : ''}</option>
                {entities.map((en) => (
                  <option key={en.id} value={en.id}>{en.name} ({en.invoicePrefix})</option>
                ))}
              </select>
              <p className="text-xs text-content-tertiary">
                New invoices for this client are issued under this company &amp; its number series.
              </p>
            </div>
          </div>
        )}

        {/* Assignments Section */}
        <Card padding="none">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
            <div>
              <h2 className="text-sm font-semibold text-content-primary">Employee Assignments</h2>
              <p className="text-xs text-content-tertiary mt-0.5">
                {active.length} active · {past.length} past
              </p>
            </div>
            <Button size="xs" onClick={() => setShowAssignModal(true)}>
              + Assign Employee
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">Employee</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">Start</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">End</th>
                  <th className="text-right px-4 py-2.5 font-medium text-content-secondary">Billing</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-secondary">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-content-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-content-tertiary">
                      No assignments yet. Click &quot;Assign Employee&quot; to start billing this client.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-content-primary">
                          {a.employee.firstName} {a.employee.lastName}
                        </p>
                        <p className="text-xs text-content-tertiary font-mono">{a.employee.employeeCode}</p>
                      </td>
                      <td className="px-4 py-2.5 text-content-secondary">{a.role ?? a.employee.designation ?? '—'}</td>
                      <td className="px-4 py-2.5 text-content-secondary text-xs">
                        {a.workSchedule === 'PART_TIME' ? 'Part-Time' : 'Full-Time'}
                      </td>
                      <td className="px-4 py-2.5 text-content-secondary text-xs">
                        {new Date(a.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5 text-content-secondary text-xs">
                        {a.endDate
                          ? new Date(a.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {a.currency} {Number(a.billingRate).toLocaleString()} / {a.billingCycle.toLowerCase()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_BADGE_VARIANT[a.status]}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {a.status === 'ACTIVE' ? (
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleGenerateInvoice(a.id)}
                              disabled={invoicingId === a.id}
                              loading={invoicingId === a.id}
                              title="Generate an advance invoice for this employee"
                            >
                              {invoicingId === a.id ? 'Generating...' : 'Invoice'}
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleEndAssignment(a.id)}
                              disabled={endingId === a.id}
                              loading={endingId === a.id}
                            >
                              {endingId === a.id ? 'Ending...' : 'End'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-content-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Portal Access */}
        <Card padding="none" className="mt-6">
          <div className="flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <h2 className="text-sm font-semibold text-content-primary">Client Portal Access</h2>
              <p className="text-xs text-content-tertiary mt-0.5">
                {portalAccess?.portalEnabled ? (
                  <>
                    Enabled — <span className="font-medium">{portalAccess.email}</span> can sign in with an email OTP to view staff, attendance, leave &amp; invoices (never salary).
                    {portalAccess.lastLoginAt ? ` Last login ${new Date(portalAccess.lastLoginAt).toLocaleDateString()}.` : ' Not signed in yet.'}
                  </>
                ) : (
                  'Disabled — the client cannot sign in. Enable to let them log in at /client-portal with their email.'
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant={portalAccess?.portalEnabled ? 'secondary' : 'primary'}
              loading={portalBusy}
              onClick={() => handleTogglePortal(!portalAccess?.portalEnabled)}
            >
              {portalAccess?.portalEnabled ? 'Disable access' : 'Enable access'}
            </Button>
          </div>
        </Card>

        {/* Service Agreement */}
        <div className="mt-6">
          <LettersCard scope="client" clientId={id} />
        </div>

        {showAssignModal && (
          <AssignmentModal
            clientId={id}
            clientName={client.name}
            defaultCurrency={client.currency}
            onClose={() => setShowAssignModal(false)}
            onSuccess={() => {
              setShowAssignModal(false);
              fetchData();
            }}
          />
        )}

        {showInvoiceModal && (
          <GenerateInvoiceModal
            preselectedClientId={id}
            onClose={() => setShowInvoiceModal(false)}
            onSuccess={() => setShowInvoiceModal(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <Card>
      <p className="text-xs text-content-tertiary mb-1">{label}</p>
      <p className="text-sm text-content-primary">{value || '—'}</p>
    </Card>
  );
}
