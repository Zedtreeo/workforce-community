'use client'

import { API_BASE } from '@/lib/api';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Modal, Input, PageSkeleton, EmptyState, PageHeader } from '../../components/ui';
import { FolderOpen, Upload, Plus, Download, Trash2, AlertTriangle } from 'lucide-react';

interface DocCategory { id: string; name: string; code: string; isRequired: boolean; _count: { documents: number } }
interface EmployeeDoc {
  id: string;
  employee: { firstName: string; lastName: string; employeeCode: string };
  category: { name: string; code: string };
  fileName: string; fileSize: number; mimeType: string | null;
  expiryDate: string | null; notes: string | null; createdAt: string;
}
interface Employee { id: string; firstName: string; lastName: string; employeeCode: string }

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<'docs' | 'categories' | 'expiring'>('docs');
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expiring, setExpiring] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ employeeId: '', categoryId: '', notes: '', expiryDate: '' });
  const [file, setFile] = useState<File | null>(null);

  // Category create
  const [showCatCreate, setShowCatCreate] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', code: '', isRequired: false });

  const load = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const [d, c, e, exp] = await Promise.all([
        apiFetch<EmployeeDoc[]>('/documents', { token: session.session.token }),
        apiFetch<DocCategory[]>('/documents/categories', { token: session.session.token }),
        apiFetch<{ data: Employee[] }>('/employees?limit=500', { token: session.session.token }),
        apiFetch<EmployeeDoc[]>('/documents/expiring?days=30', { token: session.session.token }),
      ]);
      setDocs(d); setCategories(c); setEmployees(e.data || []); setExpiring(exp);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session?.session?.token]);

  useEffect(() => { load(); }, [load]);

  const uploadDoc = async () => {
    if (!session?.session?.token || !file || !uploadForm.employeeId || !uploadForm.categoryId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', uploadForm.employeeId);
      formData.append('categoryId', uploadForm.categoryId);
      if (uploadForm.notes) formData.append('notes', uploadForm.notes);
      if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);

      await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session.token}` },
        credentials: 'include',
        body: formData,
      });
      setShowUpload(false);
      setFile(null);
      setUploadForm({ employeeId: '', categoryId: '', notes: '', expiryDate: '' });
      load();
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createCategory = async () => {
    if (!session?.session?.token || !catForm.name || !catForm.code) return;
    try {
      await apiFetch('/documents/categories', {
        method: 'POST', token: session.session.token,
        body: JSON.stringify(catForm),
      });
      setShowCatCreate(false);
      setCatForm({ name: '', code: '', isRequired: false });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const deleteDoc = async (id: string) => {
    if (!session?.session?.token || !confirm('Delete this document?')) return;
    await apiFetch(`/documents/${id}`, { method: 'DELETE', token: session.session.token });
    load();
  };

  const downloadDoc = (id: string) => {
    if (!session?.session?.token) return;
    window.open(`${API_BASE}/documents/${id}/download`, '_blank');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getExpiryBadgeVariant = (daysLeft: number): 'danger' | 'warning' | 'success' => {
    if (daysLeft <= 7) return 'danger';
    if (daysLeft <= 14) return 'warning';
    return 'success';
  };

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  const tabs = [
    { key: 'docs' as const, label: `All Documents (${docs.length})` },
    { key: 'categories' as const, label: `Categories (${categories.length})` },
    { key: 'expiring' as const, label: `Expiring Soon (${expiring.length})` },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Documents"
          breadcrumbs={[{ label: 'Documents' }]}
          actions={
            <Button onClick={() => setShowUpload(true)} icon={<Upload />}>
              Upload Document
            </Button>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Documents List */}
        {tab === 'docs' && (
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">File</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Expiry</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-content-primary">{d.employee.firstName} {d.employee.lastName}</span>
                      <br />
                      <span className="text-xs text-content-tertiary">{d.employee.employeeCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="brand">{d.category.name}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-content-secondary">{d.fileName}</td>
                    <td className="px-4 py-3 text-xs text-content-tertiary">{formatSize(d.fileSize)}</td>
                    <td className="px-4 py-3 text-xs">
                      {d.expiryDate ? (
                        new Date(d.expiryDate) < new Date() ? (
                          <Badge variant="danger">{new Date(d.expiryDate).toLocaleDateString()}</Badge>
                        ) : (
                          <span className="text-content-tertiary">{new Date(d.expiryDate).toLocaleDateString()}</span>
                        )
                      ) : (
                        <span className="text-content-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="xs" icon={<Download />} onClick={() => downloadDoc(d.id)}>
                          Download
                        </Button>
                        <Button variant="ghost" size="xs" icon={<Trash2 />} className="text-danger hover:text-danger" onClick={() => deleteDoc(d.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<FolderOpen />}
                        title="No documents uploaded yet"
                        description="Upload your first document to get started."
                        action={{ label: 'Upload Document', onClick: () => setShowUpload(true) }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {/* Categories */}
        {tab === 'categories' && (
          <div className="space-y-4">
            <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => setShowCatCreate(true)}>
              Add Category
            </Button>
            <div className="grid grid-cols-3 gap-3">
              {categories.map((c) => (
                <Card key={c.id} hover>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-content-primary">{c.name}</p>
                    <Badge variant="default">{c.code}</Badge>
                  </div>
                  <p className="text-xs text-content-tertiary mt-1">
                    {c._count.documents} documents{c.isRequired && ' • Required'}
                  </p>
                </Card>
              ))}
              {categories.length === 0 && (
                <div className="col-span-3">
                  <Card>
                    <EmptyState
                      icon={<FolderOpen />}
                      title="No categories yet"
                      description="Create a category to organize your documents."
                      action={{ label: 'Add Category', onClick: () => setShowCatCreate(true) }}
                    />
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expiring */}
        {tab === 'expiring' && (
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Document</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Expiry Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {expiring.map((d) => {
                  const daysLeft = Math.ceil((new Date(d.expiryDate!).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={d.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-content-primary">{d.employee.firstName} {d.employee.lastName}</td>
                      <td className="px-4 py-3 text-content-secondary">{d.category.name} — {d.fileName}</td>
                      <td className="px-4 py-3 text-content-secondary">{new Date(d.expiryDate!).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getExpiryBadgeVariant(daysLeft)} dot>
                          {daysLeft} days
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {expiring.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={<AlertTriangle />}
                        title="No documents expiring soon"
                        description="No documents are expiring in the next 30 days."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Document"
        description="Upload a document for an employee."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={uploadDoc}
              loading={uploading}
              disabled={uploading || !file || !uploadForm.employeeId || !uploadForm.categoryId}
              icon={<Upload />}
            >
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-primary">Employee</label>
            <select
              className="w-full h-9 rounded-lg border border-surface-200 hover:border-surface-300 bg-white px-3 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={uploadForm.employeeId}
              onChange={(e) => setUploadForm({ ...uploadForm, employeeId: e.target.value })}
            >
              <option value="">Select Employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-primary">Category</label>
            <select
              className="w-full h-9 rounded-lg border border-surface-200 hover:border-surface-300 bg-white px-3 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={uploadForm.categoryId}
              onChange={(e) => setUploadForm({ ...uploadForm, categoryId: e.target.value })}
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-primary">File</label>
            <input
              type="file"
              className="w-full h-9 rounded-lg border border-surface-200 hover:border-surface-300 bg-white px-3 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-brand-600"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <Input
            label="Expiry Date (optional)"
            type="date"
            value={uploadForm.expiryDate}
            onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
          />
          <Input
            label="Notes (optional)"
            placeholder="Add notes about this document"
            value={uploadForm.notes}
            onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
          />
        </div>
      </Modal>

      {/* Category Create Modal */}
      <Modal
        open={showCatCreate}
        onClose={() => setShowCatCreate(false)}
        title="New Category"
        description="Create a new document category."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCatCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createCategory} icon={<Plus />}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g. ID Proof"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
          />
          <Input
            label="Code"
            placeholder="e.g. ID"
            value={catForm.code}
            onChange={(e) => setCatForm({ ...catForm, code: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-content-primary cursor-pointer">
            <input
              type="checkbox"
              checked={catForm.isRequired}
              onChange={(e) => setCatForm({ ...catForm, isRequired: e.target.checked })}
              className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            Required for all employees
          </label>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
