'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { usePermissions } from '../../lib/use-permissions';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, StatCard, Badge, Modal, PageSkeleton, PageHeader } from '../../components/ui';
import { Users, Building2, Plus, Pencil, UserX } from 'lucide-react';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  plan: string;
  currency: string;
  timezone: string;
  gstNumber: string | null;
  panNumber: string | null;
  pfNumber: string | null;
  esiNumber: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; employees: number; clients: number };
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  image: string | null;
}

const roleBadgeVariant: Record<string, 'brand' | 'info' | 'success' | 'default'> = {
  OWNER: 'brand',
  ADMIN: 'info',
  MANAGER: 'success',
  MEMBER: 'default',
  VIEWER: 'default',
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const { hasMinRole } = usePermissions();
  const isAdminOrAbove = hasMinRole('ADMIN');
  const [tab, setTab] = useState<'company' | 'users'>('company');

  // -- Company Info --
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [editTenant, setEditTenant] = useState<Record<string, string>>({});
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantMsg, setTenantMsg] = useState('');

  // -- Users --
  const [users, setUsers] = useState<User[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'MEMBER', password: '' });
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', role: '' });

  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const data = await apiFetch<TenantSettings>('/settings/tenant', {
        token: session.session.token,
      });
      setTenant(data);
      setEditTenant({
        name: data.name || '',
        currency: data.currency || 'INR',
        timezone: data.timezone || 'Asia/Kolkata',
        gstNumber: data.gstNumber || '',
        panNumber: data.panNumber || '',
        pfNumber: data.pfNumber || '',
        esiNumber: data.esiNumber || '',
        website: data.website || '',
        phone: data.phone || '',
        address: data.address || '',
      });
    } catch { /* ignore */ }
  }, [session?.session?.token]);

  const loadUsers = useCallback(async () => {
    if (!session?.session?.token) return;
    try {
      const data = await apiFetch<User[]>('/settings/users', {
        token: session.session.token,
      });
      setUsers(data);
    } catch { /* ignore */ }
  }, [session?.session?.token]);

  useEffect(() => {
    if (session?.session?.token) {
      Promise.all([loadTenant(), loadUsers()]).finally(() => setLoading(false));
    }
  }, [session?.session?.token, loadTenant, loadUsers]);

  const saveTenantSettings = async () => {
    if (!session?.session?.token) return;
    setSavingTenant(true);
    setTenantMsg('');
    try {
      await apiFetch('/settings/tenant', {
        method: 'PATCH',
        token: session.session.token,
        body: JSON.stringify(editTenant),
      });
      setTenantMsg('Settings saved.');
      loadTenant();
    } catch (e: any) {
      setTenantMsg(e.message || 'Failed to save');
    } finally {
      setSavingTenant(false);
    }
  };

  const inviteUser = async () => {
    if (!session?.session?.token || !inviteForm.email || !inviteForm.password) return;
    setInviting(true);
    try {
      await apiFetch('/settings/users/invite', {
        method: 'POST',
        token: session.session.token,
        body: JSON.stringify(inviteForm),
      });
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'MEMBER', password: '' });
      loadUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const updateUser = async () => {
    if (!session?.session?.token || !editingUser) return;
    try {
      await apiFetch(`/settings/users/${editingUser.id}`, {
        method: 'PATCH',
        token: session.session.token,
        body: JSON.stringify(editUserForm),
      });
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to update user');
    }
  };

  const deactivateUser = async (userId: string) => {
    if (!session?.session?.token) return;
    if (!confirm('Deactivate this user?')) return;
    try {
      await apiFetch(`/settings/users/${userId}/deactivate`, {
        method: 'POST',
        token: session.session.token,
      });
      loadUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to deactivate');
    }
  };

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  const roles = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

  const allTabs = [
    { key: 'company' as const, label: 'Company Info', icon: <Building2 className="h-4 w-4" /> },
    { key: 'users' as const, label: 'User Management', icon: <Users className="h-4 w-4" /> },
  ];
  const tabs = isAdminOrAbove ? allTabs : allTabs.filter(t => t.key !== 'users');

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Settings"
          breadcrumbs={[{ label: 'Settings' }]}
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Company Info ── */}
        {tab === 'company' && tenant && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Users"
                value={tenant._count.users}
                icon={<Users />}
              />
              <StatCard
                label="Employees"
                value={tenant._count.employees}
                icon={<Users />}
              />
              <StatCard
                label="Clients"
                value={tenant._count.clients}
                icon={<Building2 />}
              />
            </div>

            {/* Company Form */}
            <Card padding="lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Company Name</label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editTenant.name || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Slug</label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-surface-50 text-sm text-content-tertiary focus:outline-none"
                    value={tenant.slug}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Currency</label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editTenant.currency || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, currency: e.target.value })}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Timezone</label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editTenant.timezone || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, timezone: e.target.value })}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (ET)</option>
                    <option value="America/Chicago">America/Chicago (CT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </select>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-content-primary mt-6 mb-3">Compliance Numbers</h3>
              <div className="grid grid-cols-2 gap-4">
                {(['gstNumber', 'panNumber', 'pfNumber', 'esiNumber'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-content-secondary mb-1">
                      {field.replace('Number', '').toUpperCase()} Number
                    </label>
                    <input
                      className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={editTenant[field] || ''}
                      onChange={(e) => setEditTenant({ ...editTenant, [field]: e.target.value })}
                      placeholder={`Enter ${field.replace('Number', '').toUpperCase()} number`}
                    />
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-content-primary mt-6 mb-3">Contact Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Website</label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editTenant.website || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, website: e.target.value })}
                    placeholder="https://www.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Phone</label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={editTenant.phone || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-content-secondary mb-1">Address</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    rows={2}
                    value={editTenant.address || ''}
                    onChange={(e) => setEditTenant({ ...editTenant, address: e.target.value })}
                    placeholder="Registered office address"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  onClick={saveTenantSettings}
                  loading={savingTenant}
                >
                  {savingTenant ? 'Saving...' : 'Save Changes'}
                </Button>
                {tenantMsg && <span className="text-sm text-success-dark">{tenantMsg}</span>}
              </div>

              <div className="mt-6 pt-4 border-t border-surface-200 text-xs text-content-tertiary">
                Plan: <span className="font-medium text-content-secondary">{tenant.plan}</span> &middot;
                Created: {new Date(tenant.createdAt).toLocaleDateString()}
              </div>
            </Card>
          </div>
        )}

        {/* ── User Management ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-content-tertiary">{users.length} users</p>
              {isAdminOrAbove && (
                <Button
                  onClick={() => setShowInvite(true)}
                  icon={<Plus />}
                >
                  Invite User
                </Button>
              )}
            </div>

            <Card padding="none">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-content-primary">{u.name || '—'}</p>
                        <p className="text-xs text-content-tertiary">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant[u.role] || 'default'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.isActive ? 'success' : 'danger'} dot>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-content-tertiary">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={<Pencil />}
                            onClick={() => { setEditingUser(u); setEditUserForm({ name: u.name || '', role: u.role }); }}
                          >
                            Edit
                          </Button>
                          {u.isActive && (
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={<UserX />}
                              className="text-danger-dark hover:text-danger-dark"
                              onClick={() => deactivateUser(u.id)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>

      {/* ── Invite User Modal ── */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite New User"
        description="Add a new user to your organization"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={inviteUser}
              loading={inviting}
              disabled={inviting || !inviteForm.email || !inviteForm.password}
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Email</label>
            <input
              placeholder="user@company.com"
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Full Name</label>
            <input
              placeholder="John Doe"
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Password</label>
            <input
              placeholder="Temporary password"
              type="password"
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Role</label>
            <select
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User`}
        description={editingUser?.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={updateUser}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Full Name</label>
            <input
              placeholder="Full Name"
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={editUserForm.name}
              onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Role</label>
            <select
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={editUserForm.role}
              onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
            >
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
