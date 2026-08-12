'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, Paperclip, X, RefreshCw, PenSquare, Send, Reply } from 'lucide-react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { useToast } from '../ui/toast';

interface Draft { to: string; cc: string; subject: string; body: string }

interface Sender { name?: string; address?: string }
interface InboxItem {
  uid: string; from: Sender; subject: string; date: string; unseen: boolean; hasAttachments: boolean;
}
interface InboxResp { available: boolean; address: string; messages: InboxItem[] }
interface MessageResp {
  uid: string; from: Sender; subject: string; date: string; text: string; html: string; hasAttachments: boolean;
}

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/**
 * Employee-portal inbox card: the 5 latest messages from the user's own
 * @legelp.com mailbox (Hostinger). Renders nothing if the user has no mailbox.
 * Message bodies render inside a sandboxed iframe (no script execution).
 */
export function PortalInbox() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const token = session?.session?.token;

  const [boxes, setBoxes] = useState<{ address: string; own: boolean }[] | null>(null);
  const [active, setActive] = useState<string>('');
  const [resp, setResp] = useState<InboxResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<MessageResp | null>(null);
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);

  // Discover the mailboxes this user may open (own + granted shared boxes).
  useEffect(() => {
    if (!token) return;
    apiFetch<{ address: string; own: boolean }[]>('/portal/email/mailboxes', { token })
      .then((list) => {
        setBoxes(list);
        setActive(list.find((b) => b.own)?.address || list[0]?.address || '');
        if (!list.length) setLoading(false);
      })
      .catch(() => { setBoxes([]); setLoading(false); });
  }, [token]);

  const load = useCallback(async () => {
    if (!token || !active) return;
    setLoading(true);
    try {
      setResp(await apiFetch<InboxResp>(`/portal/email/inbox?mailbox=${encodeURIComponent(active)}&limit=5`, { token }));
    } catch { setResp({ available: false, address: active, messages: [] }); }
    finally { setLoading(false); }
  }, [token, active]);

  useEffect(() => { if (active) load(); }, [active, load]);

  const openMessage = async (uid: string) => {
    if (!token) return;
    setReading(true);
    try {
      setOpen(await apiFetch<MessageResp>(`/portal/email/message/${encodeURIComponent(uid)}?mailbox=${encodeURIComponent(active)}`, { token }));
    } catch { /* ignore */ } finally { setReading(false); }
  };

  const compose = () => setDraft({ to: '', cc: '', subject: '', body: '' });
  const reply = () => {
    if (!open) return;
    setDraft({
      to: open.from?.address || '',
      cc: '',
      subject: open.subject.startsWith('Re:') ? open.subject : `Re: ${open.subject}`,
      body: `\n\n---\nOn ${new Date(open.date).toLocaleString()}, ${open.from?.name || open.from?.address} wrote:\n${(open.text || '').split('\n').map((l) => '> ' + l).join('\n')}`,
    });
    setOpen(null);
  };

  const sendDraft = async () => {
    if (!token || !draft) return;
    if (!draft.to.trim()) { toast('error', 'Add a recipient'); return; }
    setSending(true);
    try {
      await apiFetch('/portal/email/send', {
        method: 'POST', token,
        body: JSON.stringify({ mailbox: active, to: draft.to, cc: draft.cc, subject: draft.subject, body: draft.body }),
      });
      toast('success', 'Email sent');
      setDraft(null);
    } catch (e: any) {
      toast('error', e?.message || 'Could not send');
    } finally { setSending(false); }
  };

  // Hide entirely for users with no accessible mailbox (most contractors).
  if (boxes === null) return null;      // still discovering
  if (!boxes.length) return null;       // no mailbox for this user

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-brand-600" />
          <span className="text-sm font-semibold text-content-primary">Inbox</span>
          {boxes.length > 1 ? (
            <select
              value={active}
              onChange={(e) => setActive(e.target.value)}
              className="text-[11px] text-content-secondary bg-surface-50 border border-surface-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {boxes.map((b) => (
                <option key={b.address} value={b.address}>{b.address}{b.own ? ' (you)' : ''}</option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] text-content-tertiary">{active}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={compose} title="Compose" className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
            <PenSquare size={14} /> Compose
          </button>
          <button onClick={load} title="Refresh" className="h-7 w-7 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading || !resp ? (
        <p className="text-center text-content-tertiary text-sm py-8">Loading…</p>
      ) : resp.messages.length === 0 ? (
        <p className="text-center text-content-tertiary text-sm py-8">No messages.</p>
      ) : (
        <ul>
          {resp.messages.map((m) => (
            <li key={m.uid}>
              <button
                onClick={() => openMessage(m.uid)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-50 border-b border-surface-100 last:border-0"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${m.unseen ? 'bg-brand-500' : 'bg-transparent'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${m.unseen ? 'font-semibold text-content-primary' : 'text-content-secondary'}`}>
                      {m.from?.name || m.from?.address || 'Unknown'}
                    </p>
                    <span className="text-[10px] text-content-tertiary shrink-0">{when(m.date)}</span>
                  </div>
                  <p className="text-xs text-content-tertiary truncate flex items-center gap-1">
                    {m.hasAttachments && <Paperclip size={11} className="shrink-0" />}
                    {m.subject}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Reader */}
      {(open || reading) && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
          <div className="relative bg-white rounded-xl shadow-overlay w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-surface-200">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary truncate">{open?.subject || 'Loading…'}</p>
                {open && (
                  <p className="text-xs text-content-tertiary truncate">
                    {open.from?.name || ''} &lt;{open.from?.address}&gt; · {new Date(open.date).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {open && (
                  <button onClick={reply} title="Reply" className="h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
                    <Reply size={15} /> Reply
                  </button>
                )}
                <button onClick={() => setOpen(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {reading && !open ? (
                <p className="text-center text-content-tertiary text-sm py-10">Loading…</p>
              ) : open?.html ? (
                <iframe
                  title="message"
                  sandbox=""
                  srcDoc={open.html}
                  className="w-full h-[60vh] border-0 bg-white"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words text-sm text-content-primary p-5 font-sans">
                  {open?.text || '(empty message)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose / Reply */}
      {draft && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => !sending && setDraft(null)} />
          <div className="relative bg-white rounded-xl shadow-overlay w-full max-w-xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
              <span className="text-sm font-semibold text-content-primary">New message · from {active}</span>
              <button onClick={() => !sending && setDraft(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-auto">
              <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="To (comma-separated)"
                className="w-full h-9 px-3 rounded-lg bg-surface-50 border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} placeholder="Cc (optional)"
                className="w-full h-9 px-3 rounded-lg bg-surface-50 border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Subject"
                className="w-full h-9 px-3 rounded-lg bg-surface-50 border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Write your message…" rows={10}
                className="w-full resize-y px-3 py-2 rounded-lg bg-surface-50 border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-200">
              <button onClick={() => setDraft(null)} disabled={sending} className="h-9 px-4 rounded-lg text-sm text-content-secondary hover:bg-surface-100">Cancel</button>
              <button onClick={sendDraft} disabled={sending || !draft.to.trim()} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40 hover:bg-brand-700">
                <Send size={15} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
