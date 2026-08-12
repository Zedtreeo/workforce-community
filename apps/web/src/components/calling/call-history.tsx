'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhoneIncoming, PhoneOutgoing, Phone, Video } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../ui/avatar';
import type { CallHistoryEntry } from '../../lib/call-socket';
import { useCall } from './call-provider';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function subtitle(c: CallHistoryEntry): { text: string; missed: boolean } {
  switch (c.status) {
    case 'MISSED':
      return { text: c.direction === 'incoming' ? 'Missed call' : 'No answer', missed: true };
    case 'REJECTED':
      return { text: 'Declined', missed: true };
    case 'CANCELLED':
      return { text: 'Cancelled', missed: false };
    case 'ACCEPTED':
    case 'ENDED':
      return { text: c.durationSec != null ? formatDuration(c.durationSec) : 'Ended', missed: false };
    default:
      return { text: 'Ringing', missed: false };
  }
}

export function CallHistory() {
  const { startCall, state } = useCall();
  const [items, setItems] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: CallHistoryEntry[] }>('/calls?limit=15');
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const busy = state.status !== 'idle';

  if (loading) {
    return <div className="text-center py-8 text-content-tertiary text-sm">Loading…</div>;
  }
  if (items.length === 0) {
    return <div className="text-center py-8 text-content-tertiary text-sm">No recent calls</div>;
  }

  return (
    <>
      {items.map((c) => {
        const sub = subtitle(c);
        const DirIcon = c.direction === 'outgoing' ? PhoneOutgoing : PhoneIncoming;
        return (
          <div
            key={c.id}
            className="px-4 py-2.5 border-b border-surface-100 flex items-center gap-3 hover:bg-surface-50 transition-colors"
          >
            <Avatar name={c.peer.name} src={c.peer.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content-primary truncate">{c.peer.name}</p>
              <p className={`text-[11px] flex items-center gap-1 ${sub.missed ? 'text-danger' : 'text-content-tertiary'}`}>
                <DirIcon size={11} />
                {sub.text} · {timeAgo(c.createdAt)}
              </p>
            </div>
            <button
              onClick={() => startCall({ id: c.peer.id, name: c.peer.name }, c.media)}
              disabled={busy}
              title={`Call ${c.peer.name} back`}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {c.media === 'VIDEO' ? <Video size={16} /> : <Phone size={16} />}
            </button>
          </div>
        );
      })}
    </>
  );
}
