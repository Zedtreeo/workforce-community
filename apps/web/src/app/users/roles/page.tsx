'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';
import { usePermissions } from '../../../lib/use-permissions';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Badge, Card, PageSkeleton, PageHeader, EmptyState } from '../../../components/ui';
import { RoleEditorModal } from '../../../components/role-editor-modal';
import { AccessProfile, ROLE_BADGE, scopeSummary, moduleLabel } from '../../../lib/access-roles';
import { ShieldCheck, Plus, Pencil, Trash2, Users, Lock } from 'lucide-react';

export default function RolesPage() {
  const { loading: permsLoading, hasMinRole } = usePermissions();
  const isAdmin = hasMinRole('ADMIN');
  // The server blocks granting anything beyond the acting admin's own access.
  const canEdit = isAdmin;

  const [profiles, setProfiles] = useState<AccessProfile[] | null>(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<'new' | AccessProfile | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setProfiles(await apiFetch<AccessProfile[]>('/users/access-profiles'));
    } catch (e: any) {
      setError(e.message || 'Failed to load roles');
      setProfiles([]);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const remove = async (p: AccessProfile) => {
    if (!confirm(`Delete the "${p.name}" role?`)) return;
    try {
      await apiFetch(`/users/access-profiles/${p.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to delete role');
    }
  };

  if (permsLoading || (isAdmin && !profiles)) {
    return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <Card>
            <p className="text-sm text-content-secondary text-center py-8">Role management is available to administrators only.</p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
        <PageHeader
          title="Roles"
          description="Each role bundles a base permission level with module access. Assign roles from the Users page."
          breadcrumbs={[{ label: 'Users', href: '/users' }, { label: 'Roles' }]}
          actions={
            canEdit ? (
              <Button icon={<Plus size={16} />} onClick={() => setEditor('new')}>Create Role</Button>
            ) : undefined
          }
        />

        {error && <Card><p className="text-sm text-danger-dark">{error}</p></Card>}

        {profiles && profiles.length === 0 && !error && (
          <EmptyState
            icon={<ShieldCheck />}
            title="No roles yet"
            description="Create a role to bundle a permission level with module access."
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {profiles?.map((p) => {
            const s = scopeSummary(p.scopes);
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-content-primary">{p.name}</h3>
                      <Badge variant={ROLE_BADGE[p.baseRole] || 'default'}>{p.baseRole}</Badge>
                      {p.isSystem && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-content-tertiary">
                          <Lock size={10} /> System
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-sm text-content-tertiary mt-1">{p.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditor(p)}
                        className="p-2 text-content-tertiary hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
                        title="Edit role"
                      >
                        <Pencil size={15} />
                      </button>
                      {!p.isSystem && (
                        <button
                          onClick={() => remove(p)}
                          className="p-2 text-content-tertiary hover:text-danger rounded-lg hover:bg-danger-light transition-colors"
                          title="Delete role"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Badge variant={s.variant}>{s.text}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-content-tertiary">
                    <Users size={12} /> {p._count?.users ?? 0} user{(p._count?.users ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>

                {p.scopes && p.scopes.modules.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.scopes.modules.map((m) => (
                      <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-surface-50 border border-surface-200 text-content-secondary">
                        {moduleLabel(m)}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <RoleEditorModal
          target={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => { await load(); }}
        />
      </div>
    </DashboardLayout>
  );
}
