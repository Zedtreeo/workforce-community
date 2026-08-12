'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Input, Modal, PageSkeleton, PageHeader } from '../../components/ui';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count: { employees: number };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newDept, setNewDept] = useState({ name: '', code: '' });

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', code: '' });
  const [editing, setEditing] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await apiFetch<{ data: Department[]; meta: Meta }>(
        `/departments?${params.toString()}`,
      );
      setDepartments(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoading(false);
    }
  }, [session, search]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreate = async () => {
    if (!newDept.name || !newDept.code) {
      setCreateError('Name and code are required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify(newDept),
      });
      setShowCreate(false);
      setNewDept({ name: '', code: '' });
      fetchDepartments();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editId) return;
    setEditing(true);
    try {
      await apiFetch(`/departments/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify(editData),
      });
      setEditId(null);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete department "${name}"? Employees in this department will be unaffected.`)) return;
    try {
      await apiFetch(`/departments/${id}`, { method: 'DELETE' });
      fetchDepartments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading && !meta) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Departments"
          description={meta ? `${meta.total} departments` : 'Loading...'}
          breadcrumbs={[{ label: 'Departments' }]}
          actions={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              Add Department
            </Button>
          }
        />

        {/* Search */}
        <div className="max-w-md">
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Building2 size={15} />}
          />
        </div>

        {/* Create Modal */}
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); setCreateError(''); }}
          title="New Department"
          description="Create a new department for your organization."
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
              <Button onClick={handleCreate} loading={creating}>Create</Button>
            </div>
          }
        >
          {createError && (
            <p className="text-sm text-danger mb-3">{createError}</p>
          )}
          <div className="space-y-4">
            <Input
              label="Department Name"
              placeholder="e.g., Engineering"
              value={newDept.name}
              onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Code"
              placeholder="e.g., ENG"
              value={newDept.code}
              onChange={(e) => setNewDept((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            />
          </div>
        </Modal>

        {/* Table */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employees</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-content-tertiary">
                      Loading departments...
                    </td>
                  </tr>
                ) : departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-content-tertiary">
                      {search ? 'No departments match your search.' : 'No departments yet. Create your first one.'}
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3">
                        {editId === dept.id ? (
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                            className="h-8 px-2 border border-brand-300 rounded-md text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        ) : (
                          <span className="font-medium text-content-primary">{dept.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-content-secondary">
                        {editId === dept.id ? (
                          <input
                            type="text"
                            value={editData.code}
                            onChange={(e) => setEditData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                            className="h-8 px-2 border border-brand-300 rounded-md text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        ) : (
                          dept.code
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="brand">{dept._count.employees}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={dept.isActive ? 'success' : 'default'} dot>
                          {dept.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editId === dept.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="primary" size="xs" onClick={handleUpdate} loading={editing}>Save</Button>
                            <Button variant="ghost" size="xs" onClick={() => setEditId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={<Pencil size={14} />}
                              onClick={() => { setEditId(dept.id); setEditData({ name: dept.name, code: dept.code }); }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={<Trash2 size={14} />}
                              onClick={() => handleDelete(dept.id, dept.name)}
                              className="text-danger hover:text-danger"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
