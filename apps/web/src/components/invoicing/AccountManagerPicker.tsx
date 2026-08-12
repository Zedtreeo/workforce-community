// apps/web/src/components/invoicing/AccountManagerPicker.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button, FormField, Select, Badge } from '../../components/ui';
import { UserCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface User { id: string; name: string; email: string; role: string; }

export function AccountManagerPicker({
  clientId, currentManager, onUpdated,
}: {
  clientId: string;
  currentManager?: { id: string; name: string; email: string } | null;
  onUpdated?: (next: User | null) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentManager?.id ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ data: User[] } | User[]>(`/users?limit=200`).then((res) => {
      const list = Array.isArray(res) ? res : res.data;
      setUsers(list.filter((u) => ['MANAGER', 'ADMIN', 'OWNER'].includes(u.role)));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<any>(`/clients/${clientId}/account-manager`, {
        method: 'PATCH',
        body: JSON.stringify({ accountManagerId: selected || null }),
      });
      onUpdated?.(res.accountManager);
      setEditing(false);
    } finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-surface-200 bg-surface-50">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-content-tertiary" />
          <span className="text-sm text-content-secondary">Account Manager:</span>
          {currentManager ? (
            <Badge variant="info" dot>{currentManager.name} ({currentManager.email})</Badge>
          ) : (
            <span className="text-sm text-content-tertiary italic">unassigned</span>
          )}
        </div>
        <Button variant="secondary" size="xs" onClick={() => setEditing(true)}>
          {currentManager ? 'Change' : 'Assign'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 p-3 rounded-lg border border-brand-200 bg-brand-50/30">
      <div className="flex-1">
        <FormField label="Account Manager (MANAGER+ only)">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            options={[{ value: '', label: '— Unassigned —' }, ...users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email} (${u.role})` }))]}
          />
        </FormField>
      </div>
      <Button onClick={save} loading={saving} size="sm">Save</Button>
      <Button variant="secondary" size="sm" onClick={() => { setSelected(currentManager?.id ?? ''); setEditing(false); }}>Cancel</Button>
    </div>
  );
}
