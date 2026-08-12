'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton, EmptyState, PageHeader } from '../../../components/ui';
import { Layers, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface PayHead {
  id: string;
  name: string;
  code: string;
  type: 'EARNING' | 'DEDUCTION';
  category: 'FIXED' | 'VARIABLE' | 'STATUTORY';
  description: string | null;
  isStatutory: boolean;
  statutoryType: string | null;
  sortOrder: number;
  isActive: boolean;
}

const categoryColors: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'> = {
  FIXED: 'info',
  VARIABLE: 'warning',
  STATUTORY: 'brand',
};

export default function PayHeadsPage() {
  const { data: session } = useSession();
  const [heads, setHeads] = useState<PayHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHead, setEditingHead] = useState<PayHead | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<{
    name: string; code: string; type: string; category: string;
    description: string; isStatutory: boolean; statutoryType: string; sortOrder: number;
  }>({
    name: '', code: '', type: 'EARNING', category: 'FIXED',
    description: '', isStatutory: false, statutoryType: '', sortOrder: 0,
  });

  const fetchHeads = useCallback(async () => {
    try {
      const data = await apiFetch<PayHead[]>('/pay-structure/heads');
      setHeads(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHeads(); }, [fetchHeads]);

  const openCreate = () => {
    setEditingHead(null);
    setFormData({ name: '', code: '', type: 'EARNING' as string, category: 'FIXED' as string, description: '', isStatutory: false, statutoryType: '', sortOrder: heads.length });
    setShowModal(true);
    setError('');
  };

  const openEdit = (head: PayHead) => {
    setEditingHead(head);
    setFormData({
      name: head.name, code: head.code, type: head.type, category: head.category,
      description: head.description || '', isStatutory: head.isStatutory,
      statutoryType: head.statutoryType || '', sortOrder: head.sortOrder,
    });
    setShowModal(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingHead) {
        await apiFetch(`/pay-structure/heads/${editingHead.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formData.name, description: formData.description, sortOrder: formData.sortOrder }),
        });
      } else {
        await apiFetch('/pay-structure/heads', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            statutoryType: formData.isStatutory ? formData.statutoryType : undefined,
          }),
        });
      }
      setShowModal(false);
      fetchHeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (head: PayHead) => {
    try {
      await apiFetch(`/pay-structure/heads/${head.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !head.isActive }),
      });
      fetchHeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteHead = async (head: PayHead) => {
    if (!confirm(`Delete "${head.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/pay-structure/heads/${head.id}`, { method: 'DELETE' });
      fetchHeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const seedDefaults = async () => {
    try {
      await apiFetch('/pay-structure/seed-india', { method: 'POST' });
      fetchHeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const earnings = heads.filter(h => h.type === 'EARNING');
  const deductions = heads.filter(h => h.type === 'DEDUCTION');

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader
        title="Pay Heads"
        description="Define earning and deduction components for pay structures"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Pay Head</Button>
        {heads.length === 0 && (
          <Button variant="secondary" onClick={seedDefaults}>
            Seed India Defaults (Basic+DA, HRA, PF, ESI, PT)
          </Button>
        )}
      </div>

      {heads.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No pay heads defined"
          description="Create pay heads or seed Indian defaults to get started."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-green-700 flex items-center gap-2">
                <ArrowUp className="w-4 h-4" /> Earnings ({earnings.length})
              </h3>
            </div>
            <div className="divide-y">
              {earnings.map(head => (
                <div key={head.id} className={`p-3 flex items-center justify-between ${!head.isActive ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{head.name}</span>
                      <Badge variant={categoryColors[head.category]} className="text-xs">{head.category}</Badge>
                      {head.isStatutory && <Badge variant="brand" className="text-xs">Statutory</Badge>}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{head.code}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(head)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(head)} className="p-1 text-gray-400 hover:text-yellow-600 text-xs">
                      {head.isActive ? 'Disable' : 'Enable'}
                    </button>
                    {!head.isStatutory && (
                      <button onClick={() => deleteHead(head)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              ))}
              {earnings.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No earning heads</div>}
            </div>
          </Card>

          {/* Deductions */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <ArrowDown className="w-4 h-4" /> Deductions ({deductions.length})
              </h3>
            </div>
            <div className="divide-y">
              {deductions.map(head => (
                <div key={head.id} className={`p-3 flex items-center justify-between ${!head.isActive ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{head.name}</span>
                      <Badge variant={categoryColors[head.category]} className="text-xs">{head.category}</Badge>
                      {head.isStatutory && <Badge variant="brand" className="text-xs">{head.statutoryType}</Badge>}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{head.code}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(head)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(head)} className="p-1 text-gray-400 hover:text-yellow-600 text-xs">
                      {head.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
              {deductions.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No deduction heads</div>}
            </div>
          </Card>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingHead ? 'Edit Pay Head' : 'Create Pay Head'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" required className="w-full border rounded-lg px-3 py-2 text-sm"
                value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Basic + DA" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input type="text" required className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))}
                placeholder="BASIC_DA" disabled={!!editingHead} />
            </div>
          </div>

          {!editingHead && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))}>
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as any }))}>
                  <option value="FIXED">Fixed</option>
                  <option value="VARIABLE">Variable</option>
                  <option value="STATUTORY">Statutory</option>
                </select>
              </div>
            </div>
          )}

          {!editingHead && formData.isStatutory && (
            <div>
              <label className="block text-sm font-medium mb-1">Statutory Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm"
                value={formData.statutoryType} onChange={e => setFormData(p => ({ ...p, statutoryType: e.target.value }))}>
                <option value="">Select...</option>
                <option value="PF">Provident Fund</option>
                <option value="ESI">ESI</option>
                <option value="PT">Professional Tax</option>
                <option value="GRATUITY">Gratuity</option>
                <option value="TDS">TDS</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
              value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description" />
          </div>

          {!editingHead && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.isStatutory}
                onChange={e => setFormData(p => ({ ...p, isStatutory: e.target.checked }))} />
              Statutory deduction
            </label>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">{editingHead ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
