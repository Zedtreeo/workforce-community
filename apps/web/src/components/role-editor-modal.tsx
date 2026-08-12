'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Button, Modal } from './ui';
import {
  AccessProfile, MODULE_OPTIONS, PROFILE_BASE_ROLES,
} from '../lib/access-roles';

interface Props {
  /** null = closed, 'new' = create, AccessProfile = edit */
  target: 'new' | AccessProfile | null;
  onClose: () => void;
  /** Receives the created/updated role */
  onSaved: (profile: AccessProfile) => void | Promise<void>;
  /** Shown on the save button when creating from a user's picker */
  saveLabel?: string;
}

export function RoleEditorModal({ target, onClose, onSaved, saveLabel }: Props) {
  const [form, setForm] = useState({ name: '', description: '', baseRole: 'MEMBER' });
  const [mode, setMode] = useState<'full' | 'allow' | 'deny'>('full');
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target) return;
    if (target === 'new') {
      setForm({ name: '', description: '', baseRole: 'MEMBER' });
      setMode('full');
      setModules(new Set());
    } else {
      setForm({ name: target.name, description: target.description ?? '', baseRole: target.baseRole });
      setMode(target.scopes?.mode ?? 'full');
      setModules(new Set(target.scopes?.modules ?? []));
    }
    setError('');
  }, [target]);

  const save = async () => {
    const scopes = mode === 'full' ? null : { mode, modules: [...modules] };
    if (scopes && scopes.modules.length === 0) { setError('Pick at least one module.'); return; }
    if (!form.name.trim()) { setError('Role name is required.'); return; }
    setSaving(true); setError('');
    try {
      const body = JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        baseRole: form.baseRole,
        scopes,
      });
      const saved = target === 'new'
        ? await apiFetch<AccessProfile>('/users/access-profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        : await apiFetch<AccessProfile>(`/users/access-profiles/${(target as AccessProfile).id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      await onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target === 'new' ? 'Create Role' : target ? `Edit role — ${target.name}` : ''}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={save}>{saveLabel ?? 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={target !== 'new' && !!(target as AccessProfile)?.isSystem}
              className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-50 disabled:text-content-tertiary"
              placeholder="e.g. HR access"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">Base permission level</label>
            <select
              value={form.baseRole}
              onChange={(e) => setForm((f) => ({ ...f, baseRole: e.target.value }))}
              className="w-full h-9 px-2 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {PROFILE_BASE_ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="What this role is for"
          />
        </div>

        <div className="space-y-2">
          {([
            ['full', 'All role modules', 'Everything the base permission level allows'],
            ['allow', 'Allow only selected', 'ONLY the modules ticked below'],
            ['deny', 'Block selected', 'Everything EXCEPT the modules ticked below'],
          ] as const).map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="role-editor-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-0.5 h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="text-sm font-medium text-content-primary">{label}</span>
                <span className="block text-xs text-content-tertiary">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {mode !== 'full' && (
          <div className="border border-surface-200 rounded-lg p-3 max-h-56 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {MODULE_OPTIONS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 cursor-pointer text-sm text-content-secondary">
                  <input
                    type="checkbox"
                    checked={modules.has(m.key)}
                    onChange={() => setModules((prev) => {
                      const next = new Set(prev);
                      next.has(m.key) ? next.delete(m.key) : next.add(m.key);
                      return next;
                    })}
                    className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-content-tertiary">
          Assigning this role sets the user&apos;s base permission level. Editing it updates everyone on it within 30 seconds.
          Profile, notifications, chat &amp; calls, help and the employee portal always stay available.
        </p>

        {error && <p className="text-sm text-danger-dark">{error}</p>}
      </div>
    </Modal>
  );
}
