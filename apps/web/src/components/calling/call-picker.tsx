'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../ui/avatar';
import type { DirectoryUser } from '../../lib/call-socket';
import { useCall } from './call-provider';
import { CallHistory } from './call-history';

type Tab = 'people' | 'recent';

export function CallPicker() {
  const { startCall, state } = useCall();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('people');
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DirectoryUser[]>('/calls/directory');
      setUsers(data);
    } catch {
      // silent — directory just stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (tab === 'people') void load();
  };

  const call = (u: DirectoryUser, media: 'AUDIO' | 'VIDEO') => {
    setOpen(false);
    startCall({ id: u.id, name: u.name }, media);
  };

  const busy = state.status !== 'idle';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        disabled={busy}
        title={busy ? 'You are already on a call' : 'Start a call'}
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Phone size={18} />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] bg-white rounded-xl shadow-overlay border border-surface-200 z-50 max-h-[440px] flex flex-col animate-slide-down">
          <div className="flex border-b border-surface-200">
            {(['people', 'recent'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === 'people' && users.length === 0) void load();
                }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'text-brand-600 border-b-2 border-brand-500 -mb-px'
                    : 'text-content-tertiary hover:text-content-secondary'
                }`}
              >
                {t === 'people' ? 'People' : 'Recent'}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {tab === 'recent' ? (
              <CallHistory />
            ) : loading ? (
              <div className="text-center py-8 text-content-tertiary text-sm">Loading…</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-content-tertiary text-sm">No one to call</div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="px-4 py-2.5 border-b border-surface-100 flex items-center gap-3 hover:bg-surface-50 transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        u.online ? 'bg-success' : 'bg-surface-300'
                      }`}
                      title={u.online ? 'Online' : 'Offline'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary truncate">{u.name}</p>
                    <p className="text-[11px] text-content-tertiary capitalize">{u.role.toLowerCase()}</p>
                  </div>
                  <button
                    onClick={() => call(u, 'AUDIO')}
                    disabled={!u.online}
                    title="Audio call"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Phone size={16} />
                  </button>
                  <button
                    onClick={() => call(u, 'VIDEO')}
                    disabled={!u.online}
                    title="Video call"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Video size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
