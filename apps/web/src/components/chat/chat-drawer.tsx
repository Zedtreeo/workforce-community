'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X, ArrowLeft, Send, PenSquare, Check, CheckCheck, Search, Users, Phone, Video, UsersRound,
} from 'lucide-react';
import { useChat } from './chat-provider';
import type { ActivePeer } from './chat-provider';
import { useCall } from '../calling/call-provider';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || '?';
}

function Avatar({ name, url, online }: { name: string; url: string | null; online?: boolean }) {
  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
          {initials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-success' : 'bg-surface-300'}`} />
      )}
    </div>
  );
}

function GroupAvatar() {
  return (
    <div className="h-9 w-9 rounded-full bg-brand-600/10 text-brand-700 flex items-center justify-center shrink-0">
      <UsersRound size={18} />
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
function clockTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type View = 'list' | 'new-dm' | 'new-group';

export function ChatDrawer() {
  const {
    close, connected, conversations, directory, canCreateGroups, active, messages,
    loadingMessages, typingLabel, selectDm, selectGroup, backToList, send, notifyTyping, createGroup,
  } = useChat();
  const { startGroupCall } = useCall();

  const [view, setView] = useState<View>('list');
  const [dirQuery, setDirQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [groupName, setGroupName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, typingLabel, active]);

  const openDm = (p: ActivePeer) => { setView('list'); setDirQuery(''); selectDm(p); };
  const openGroup = (id: string) => { setView('list'); selectGroup(id); };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    send(text); setDraft(''); notifyTyping(false);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]);

  const submitGroup = async () => {
    if (!groupName.trim() || picked.length === 0) return;
    setCreating(true);
    const ok = await createGroup(groupName.trim(), picked);
    setCreating(false);
    if (ok) { setView('list'); setGroupName(''); setPicked([]); }
  };

  const filteredDir = directory.filter((d) => d.name.toLowerCase().includes(dirQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={close} />
      <div className="relative w-full max-w-[400px] h-full bg-white shadow-overlay flex flex-col animate-slide-left pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="h-14 shrink-0 border-b border-surface-200 flex items-center gap-2 px-3">
          {active ? (
            <>
              <button onClick={() => { backToList(); setView('list'); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                <ArrowLeft size={18} />
              </button>
              {active.type === 'dm' ? (
                <>
                  <Avatar name={active.peer.name} url={active.peer.avatarUrl} online={active.peer.online} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-content-primary truncate">{active.peer.name}</p>
                    <p className="text-[11px] text-content-tertiary">{typingLabel ?? (active.peer.online ? 'online' : 'offline')}</p>
                  </div>
                </>
              ) : (
                <>
                  <GroupAvatar />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-content-primary truncate">{active.group.name}</p>
                    <p className="text-[11px] text-content-tertiary truncate">
                      {typingLabel ?? `${active.group.members.length} members`}
                    </p>
                  </div>
                  {canCreateGroups && (
                    <>
                      <button title="Group audio call" onClick={() => startGroupCall(active.group.id, 'AUDIO', active.group.name)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                        <Phone size={17} />
                      </button>
                      <button title="Group video call" onClick={() => startGroupCall(active.group.id, 'VIDEO', active.group.name)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                        <Video size={17} />
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          ) : view === 'new-group' ? (
            <>
              <button onClick={() => setView('list')} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100"><ArrowLeft size={18} /></button>
              <span className="text-sm font-semibold text-content-primary flex-1 pl-1">New group</span>
            </>
          ) : view === 'new-dm' ? (
            <>
              <button onClick={() => setView('list')} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100"><ArrowLeft size={18} /></button>
              <span className="text-sm font-semibold text-content-primary flex-1 pl-1">New message</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-content-primary flex-1 pl-1">
                Messages {!connected && <span className="text-[11px] font-normal text-content-tertiary">(connecting…)</span>}
              </span>
              {canCreateGroups && (
                <button onClick={() => { setView('new-group'); setGroupName(''); setPicked([]); }} title="New group" className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                  <Users size={17} />
                </button>
              )}
              <button onClick={() => { setView('new-dm'); setDirQuery(''); }} title="New message" className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
                <PenSquare size={17} />
              </button>
            </>
          )}
          <button onClick={close} className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100"><X size={18} /></button>
        </div>

        {/* Body */}
        {active ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-2 bg-surface-50">
              {loadingMessages ? (
                <p className="text-center text-content-tertiary text-sm py-8">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-content-tertiary text-sm py-8">No messages yet. Say hello 👋</p>
              ) : (
                messages.map((m, i) => {
                  const showSender = active.type === 'group' && !m.fromMe &&
                    (i === 0 || messages[i - 1].senderId !== m.senderId);
                  return (
                    <div key={m.id} className={`flex flex-col ${m.fromMe ? 'items-end' : 'items-start'}`}>
                      {showSender && <span className="text-[10px] text-content-tertiary ml-1 mb-0.5">{m.senderName}</span>}
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${m.fromMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-surface-200 text-content-primary rounded-bl-sm'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={`flex items-center gap-1 mt-0.5 ${m.fromMe ? 'justify-end text-white/70' : 'text-content-tertiary'}`}>
                          <span className="text-[10px]">{clockTime(m.createdAt)}</span>
                          {m.fromMe && active.type === 'dm' && (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="shrink-0 border-t border-surface-200 p-2 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); notifyTyping(e.target.value.length > 0); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                rows={1} placeholder="Type a message…"
                className="flex-1 resize-none max-h-32 px-3 py-2 rounded-xl bg-surface-50 border border-surface-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <button onClick={submit} disabled={!draft.trim()} className="h-9 w-9 shrink-0 rounded-xl bg-brand-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-700 transition-colors">
                <Send size={16} />
              </button>
            </div>
          </>
        ) : view === 'new-group' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-surface-100">
              <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" maxLength={80}
                className="w-full h-9 px-3 rounded-lg bg-surface-50 border border-surface-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="text-[11px] text-content-tertiary mt-2">Add up to 4 members ({picked.length}/4 selected)</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {directory.map((d) => {
                const on = picked.includes(d.id);
                const disabled = !on && picked.length >= 4;
                return (
                  <button key={d.id} onClick={() => togglePick(d.id)} disabled={disabled}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-50 ${disabled ? 'opacity-40' : ''}`}>
                    <Avatar name={d.name} url={d.avatarUrl} online={d.online} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-content-primary truncate">{d.name}</p>
                      <p className="text-[11px] text-content-tertiary capitalize">{d.role?.toLowerCase()}</p>
                    </div>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${on ? 'bg-brand-600 border-brand-600' : 'border-surface-300'}`}>
                      {on && <Check size={13} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-surface-200 p-3">
              <button onClick={submitGroup} disabled={!groupName.trim() || picked.length === 0 || creating}
                className="w-full h-10 rounded-xl bg-brand-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-700">
                {creating ? 'Creating…' : `Create group${picked.length ? ` (${picked.length + 1})` : ''}`}
              </button>
            </div>
          </div>
        ) : view === 'new-dm' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-2 sticky top-0 bg-white border-b border-surface-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                <input autoFocus value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} placeholder="Search people…"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-50 border border-surface-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            {filteredDir.map((d) => (
              <button key={d.id} onClick={() => openDm({ id: d.id, name: d.name, avatarUrl: d.avatarUrl, online: d.online })}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 text-left">
                <Avatar name={d.name} url={d.avatarUrl} online={d.online} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">{d.name}</p>
                  <p className="text-[11px] text-content-tertiary capitalize">{d.role?.toLowerCase()}</p>
                </div>
              </button>
            ))}
            {filteredDir.length === 0 && <p className="text-center text-content-tertiary text-sm py-8">No one to message.</p>}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="text-center text-content-tertiary text-sm py-10 px-6">No conversations yet.<br />Tap ✎ to start one{canCreateGroups ? ', or 👥 for a group' : ''}.</div>
            ) : (
              conversations.map((c) => (
                <button key={`${c.type}-${c.id}`}
                  onClick={() => c.type === 'dm'
                    ? openDm({ id: c.peer.id, name: c.peer.name, avatarUrl: c.peer.avatarUrl, online: c.online })
                    : openGroup(c.group.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-50 text-left border-b border-surface-100">
                  {c.type === 'dm' ? <Avatar name={c.peer.name} url={c.peer.avatarUrl} online={c.online} /> : <GroupAvatar />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-content-primary truncate">
                        {c.type === 'dm' ? c.peer.name : c.group.name}
                        {c.type === 'group' && <span className="text-[11px] font-normal text-content-tertiary ml-1">· {c.group.memberCount}</span>}
                      </p>
                      <span className="text-[10px] text-content-tertiary shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${c.unread > 0 ? 'text-content-primary font-medium' : 'text-content-tertiary'}`}>
                        {c.lastMessage.fromMe && 'You: '}{c.lastMessage.body}
                      </p>
                      {c.unread > 0 && (
                        <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                          {c.unread > 9 ? '9+' : c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
