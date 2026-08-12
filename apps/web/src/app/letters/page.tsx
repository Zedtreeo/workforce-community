// apps/web/src/app/letters/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { API_BASE, apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, PageHeader, Select, FormField, Input } from '../../components/ui';
import { LetterGenerateDialog } from '../../components/letters/LetterGenerateDialog';
import { FileText, Download, Mail, Plus } from 'lucide-react';

type LetterType = 'OFFER_LETTER' | 'APPOINTMENT_LETTER' | 'EXPERIENCE_LETTER' | 'CLIENT_AGREEMENT';

const TYPE_LABEL: Record<LetterType, string> = {
  OFFER_LETTER:       'Offer Letter',
  APPOINTMENT_LETTER: 'Appointment Letter',
  EXPERIENCE_LETTER:  'Experience & Relieving',
  CLIENT_AGREEMENT:   'Service Agreement',
};

const STATUS_VARIANT: Record<string, any> = {
  DRAFT: 'default', SENT: 'info', ACCEPTED: 'success', REJECTED: 'danger', VOIDED: 'warning',
};

interface GeneratedRow {
  id: string;
  type: LetterType;
  referenceNo?: string | null;
  fileName: string;
  status: string;
  generatedAt: string;
  sentTo?: string | null;
  template?: { name: string };
}

interface Employee { id: string; firstName: string; lastName: string; email: string; }
interface Client   { id: string; name: string; email: string; }

export default function LettersPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<GeneratedRow[]>([]);
  const [loading, setLoading] = useState(true);

  // For "Generate" form
  const [openDialog, setOpenDialog] = useState(false);
  const [genType, setGenType] = useState<LetterType>('OFFER_LETTER');
  const [genEmployeeId, setGenEmployeeId] = useState('');
  const [genClientId, setGenClientId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<GeneratedRow[]>(`/letters/history?limit=100`);
      setRows(r);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!session) return;
    fetchAll();
    apiFetch<{data: Employee[]}>(`/employees?limit=200`).then((r) => setEmployees(r.data ?? (r as any) ?? []));
    apiFetch<{data: Client[]}>(`/clients?limit=200`).then((r) => setClients(r.data ?? (r as any) ?? []));
  }, [session]);

  const isClientType = genType === 'CLIENT_AGREEMENT';

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Letters"
          description="Generate and track offer, appointment, experience, and service agreement letters"
          breadcrumbs={[{ label: 'Letters' }]}
        />

        {/* Quick generate form */}
        <Card>
          <h3 className="font-semibold text-content-primary mb-3 flex items-center gap-2">
            <Plus size={16} /> Generate a letter
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Type">
              <Select
                value={genType}
                onChange={(e) => setGenType(e.target.value as LetterType)}
                options={(Object.keys(TYPE_LABEL) as LetterType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              />
            </FormField>
            {isClientType ? (
              <FormField label="Client" required>
                <Select
                  value={genClientId}
                  onChange={(e) => setGenClientId(e.target.value)}
                  options={[{ value: '', label: '— Select —' }, ...clients.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` }))]}
                />
              </FormField>
            ) : (
              <FormField label="Employee" required>
                <Select
                  value={genEmployeeId}
                  onChange={(e) => setGenEmployeeId(e.target.value)}
                  options={[{ value: '', label: '— Select —' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.email})` }))]}
                />
              </FormField>
            )}
            <div className="flex items-end">
              <Button
                onClick={() => setOpenDialog(true)}
                disabled={isClientType ? !genClientId : !genEmployeeId}
                className="gap-1.5"
              >
                <FileText size={14} /> Open Generator
              </Button>
            </div>
          </div>
        </Card>

        {/* History */}
        <Card>
          <h3 className="font-semibold text-content-primary mb-3">All generated letters</h3>
          {loading ? (
            <div className="text-sm text-content-tertiary text-center py-6">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-content-tertiary text-center py-6">No letters yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-content-tertiary border-b border-surface-100">
                <tr>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Reference</th>
                  <th className="text-left py-2">File</th>
                  <th className="text-left py-2">Generated</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0">
                    <td className="py-2">{TYPE_LABEL[r.type]}</td>
                    <td className="py-2"><code className="text-xs">{r.referenceNo ?? '—'}</code></td>
                    <td className="py-2 text-content-tertiary text-xs">{r.fileName}</td>
                    <td className="py-2 text-content-tertiary text-xs">
                      {new Date(r.generatedAt).toLocaleDateString()}
                      {r.sentTo && <div className="text-[10px]">→ {r.sentTo}</div>}
                    </td>
                    <td className="py-2"><Badge variant={STATUS_VARIANT[r.status]} dot>{r.status}</Badge></td>
                    <td className="py-2 text-right">
                      <a href={`${API_BASE}/letters/${r.id}/download?format=pdf`} title="PDF"
                         className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary"><Download size={14}/></a>
                      <a href={`${API_BASE}/letters/${r.id}/download?format=docx`} title="DOCX"
                         className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary ml-1"><FileText size={14}/></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {openDialog && (
        <LetterGenerateDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          type={genType}
          employeeId={isClientType ? undefined : genEmployeeId}
          clientId={isClientType ? genClientId : undefined}
          onGenerated={() => fetchAll()}
        />
      )}
    </DashboardLayout>
  );
}
