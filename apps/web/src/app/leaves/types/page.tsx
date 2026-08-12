'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton } from '../../../components/ui';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  defaultDays: number;
  carryForward: boolean;
  maxCarryDays: number;
  isActive: boolean;
}

export default function LeaveTypesPage() {
  const { data: session } = useSession();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', isPaid: true, defaultDays: 12, carryForward: false, maxCarryDays: 0 });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = useCallback(async () => {
    if (!session?.session?.id) return;
    setLoading(true);
    try {
      const data = await apiFetch<LeaveType[]>('/leaves/types');
      setTypes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleCreate = async () => {
    setError('');
    if (!form.name || !form.code) { setError('Name and code are required'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/leaves/types', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ name: '', code: '', isPaid: true, defaultDays: 12, carryForward: false, maxCarryDays: 0 });
      fetchTypes();
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (t: LeaveType) => {
    try {
      await apiFetch(`/leaves/types/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      fetchTypes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/leaves" className="text-sm text-content-tertiary hover:text-content-secondary">← Back to Leaves</Link>
            <div>
              <h1 className="text-2xl font-bold text-content-primary">Leave Types</h1>
              <p className="text-sm text-content-tertiary mt-0.5">Configure leave categories and annual quotas</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ Add Leave Type</Button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : types.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-content-tertiary mb-4">No leave types configured yet</p>
            <button onClick={() => setShowCreate(true)} className="text-brand-600 font-medium text-sm">Create your first leave type</button>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-5 py-3 font-medium text-content-secondary">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-content-secondary">Code</th>
                  <th className="text-center px-5 py-3 font-medium text-content-secondary">Paid</th>
                  <th className="text-center px-5 py-3 font-medium text-content-secondary">Days/Year</th>
                  <th className="text-center px-5 py-3 font-medium text-content-secondary">Carry Forward</th>
                  <th className="text-center px-5 py-3 font-medium text-content-secondary">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-content-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-5 py-4 font-medium text-content-primary">{t.name}</td>
                    <td className="px-5 py-4">
                      <Badge variant="brand">{t.code}</Badge>
                    </td>
                    <td className="px-5 py-4 text-center">{t.isPaid ? '✓ Paid' : 'Unpaid'}</td>
                    <td className="px-5 py-4 text-center font-medium">{t.defaultDays}</td>
                    <td className="px-5 py-4 text-center text-content-tertiary">
                      {t.carryForward ? `Yes (max ${t.maxCarryDays})` : 'No'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {t.isActive
                        ? <Badge variant="success" dot>Active</Badge>
                        : <Badge variant="default" dot>Inactive</Badge>
                      }
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="xs" onClick={() => toggleActive(t)}>
                        {t.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Leave Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={submitting}>Create</Button>
          </>
        }
      >
        {error && <div className="mb-4 p-3 bg-danger-light text-danger-dark rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. Casual Leave"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. CL"
              maxLength={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Days per Year</label>
              <input
                type="number"
                value={form.defaultDays}
                onChange={(e) => setForm({ ...form, defaultDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Type</label>
              <select
                value={form.isPaid ? 'paid' : 'unpaid'}
                onChange={(e) => setForm({ ...form, isPaid: e.target.value === 'paid' })}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.carryForward}
                onChange={(e) => setForm({ ...form, carryForward: e.target.checked })}
              />
              Carry forward unused days
            </label>
          </div>
          {form.carryForward && (
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Max Carry Days</label>
              <input
                type="number"
                value={form.maxCarryDays}
                onChange={(e) => setForm({ ...form, maxCarryDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
