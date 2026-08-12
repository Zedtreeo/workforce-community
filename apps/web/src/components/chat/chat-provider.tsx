'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import {
  createChatSocket, Conversation, ChatDirectoryUser, GroupDetail,
  IncomingMessage, IncomingGroupMessage, SendAck,
} from '../../lib/chat-socket';
import { ChatDrawer } from './chat-drawer';

export interface ActivePeer {
  id: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
}

export interface DisplayMessage {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
  readAt?: string | null;       // DM only
  senderId?: string;            // group only
  senderName?: string;          // group only
  senderAvatar?: string | null; // group only
}

type Active =
  | { type: 'dm'; peer: ActivePeer }
  | { type: 'group'; group: GroupDetail };

interface ChatContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  connected: boolean;
  unreadTotal: number;
  conversations: Conversation[];
  directory: ChatDirectoryUser[];
  canCreateGroups: boolean;
  active: Active | null;
  messages: DisplayMessage[];
  loadingMessages: boolean;
  typingLabel: string | null;
  selectDm: (peer: ActivePeer) => void;
  selectGroup: (groupId: string) => void;
  backToList: () => void;
  send: (body: string) => void;
  notifyTyping: (typing: boolean) => void;
  createGroup: (name: string, memberIds: string[]) => Promise<boolean>;
  refreshConversations: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);
export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within <ChatProvider>');
  return ctx;
}

const PRIVILEGED = ['OWNER', 'ADMIN', 'MANAGER'];

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id as string | undefined;
  const myRole = ((session?.user as any)?.role ?? 'MEMBER') as string;
  const canCreateGroups = PRIVILEGED.includes(myRole);

  const [isOpen, setIsOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<ChatDirectoryUser[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshConversations = useCallback(async () => {
    try { setConversations(await apiFetch<Conversation[]>('/chat/conversations')); } catch {}
  }, []);
  const refreshUnread = useCallback(async () => {
    try { setUnreadTotal((await apiFetch<{ count: number }>('/chat/unread-count')).count); } catch {}
  }, []);

  const bumpConversation = useCallback(
    (convId: string, body: string, createdAt: string, fromMe: boolean, incUnread: boolean) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === convId);
        if (idx === -1) { refreshConversations(); return prev; }
        const c = prev[idx];
        const updated = {
          ...c,
          lastMessage: { body, createdAt, fromMe },
          unread: incUnread ? c.unread + 1 : c.unread,
        } as Conversation;
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    },
    [refreshConversations],
  );

  const clearUnreadFor = useCallback((convId: string) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === convId);
      if (conv && conv.unread > 0) setUnreadTotal((c) => Math.max(0, c - conv.unread));
      return prev.map((c) => (c.id === convId ? ({ ...c, unread: 0 } as Conversation) : c));
    });
  }, []);

  useEffect(() => {
    if (!myId) return;
    refreshUnread();
    refreshConversations();
    apiFetch<ChatDirectoryUser[]>('/chat/directory').then(setDirectory).catch(() => {});

    const socket = createChatSocket();
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // ── 1:1 ──
    socket.on('chat:message', (m: IncomingMessage) => {
      const incoming = m.from !== myId;
      const peerId = incoming ? m.from : m.to;
      const a = activeRef.current;
      const isActive = a?.type === 'dm' && a.peer.id === peerId;
      if (isActive) {
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev
          : [...prev, { id: m.id, body: m.body, fromMe: !incoming, readAt: null, createdAt: m.createdAt }]);
        if (incoming) socket.emit('chat:read', { peerId });
      } else if (incoming) setUnreadTotal((c) => c + 1);
      bumpConversation(peerId, m.body, m.createdAt, !incoming, incoming && !isActive);
    });
    socket.on('chat:read', (p: { by: string }) => {
      const a = activeRef.current;
      if (a?.type === 'dm' && a.peer.id === p.by) {
        setMessages((prev) => prev.map((x) => x.fromMe && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x));
      }
    });
    socket.on('chat:read-self', (p: { peerId: string }) => clearUnreadFor(p.peerId));
    socket.on('chat:typing', (p: { from: string; typing: boolean }) => {
      const a = activeRef.current;
      if (a?.type === 'dm' && a.peer.id === p.from) {
        setTypingUsers(p.typing ? { [p.from]: a.peer.name } : {});
      }
    });

    // ── Groups ──
    socket.on('chat:group-message', (m: IncomingGroupMessage) => {
      const incoming = m.from !== myId;
      const a = activeRef.current;
      const isActive = a?.type === 'group' && a.group.id === m.groupId;
      if (isActive) {
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev
          : [...prev, { id: m.id, body: m.body, fromMe: !incoming, senderId: m.from, senderName: m.fromName, createdAt: m.createdAt }]);
        if (incoming) socket.emit('chat:group-read', { groupId: m.groupId });
      } else if (incoming) setUnreadTotal((c) => c + 1);
      bumpConversation(m.groupId, m.body, m.createdAt, !incoming, incoming && !isActive);
    });
    socket.on('chat:group-read-self', (p: { groupId: string }) => clearUnreadFor(p.groupId));
    socket.on('chat:group-typing', (p: { groupId: string; from: string; fromName: string; typing: boolean }) => {
      const a = activeRef.current;
      if (a?.type === 'group' && a.group.id === p.groupId) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (p.typing) next[p.from] = p.fromName; else delete next[p.from];
          return next;
        });
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const selectDm = useCallback((peer: ActivePeer) => {
    setActive({ type: 'dm', peer });
    setTypingUsers({});
    setLoadingMessages(true);
    apiFetch<DisplayMessage[]>(`/chat/messages?peer=${encodeURIComponent(peer.id)}`)
      .then((rows) => setMessages(rows)).catch(() => setMessages([])).finally(() => setLoadingMessages(false));
    socketRef.current?.emit('chat:read', { peerId: peer.id });
    clearUnreadFor(peer.id);
  }, [clearUnreadFor]);

  const selectGroup = useCallback((groupId: string) => {
    setTypingUsers({});
    setLoadingMessages(true);
    apiFetch<GroupDetail>(`/chat/groups/${groupId}`)
      .then((g) => setActive({ type: 'group', group: g })).catch(() => {});
    apiFetch<DisplayMessage[]>(`/chat/groups/${groupId}/messages`)
      .then((rows) => setMessages(rows)).catch(() => setMessages([])).finally(() => setLoadingMessages(false));
    socketRef.current?.emit('chat:group-read', { groupId });
    clearUnreadFor(groupId);
  }, [clearUnreadFor]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const backToList = useCallback(() => {
    setActive(null); setMessages([]); setTypingUsers({}); refreshConversations();
  }, [refreshConversations]);

  const send = useCallback((body: string) => {
    const a = activeRef.current; const socket = socketRef.current;
    if (!a || !socket || !body.trim()) return;
    const text = body.trim();
    if (a.type === 'dm') {
      socket.emit('chat:send', { toUserId: a.peer.id, body: text }, (ack: SendAck) => {
        if (ack?.ok && ack.message) {
          const m = ack.message as IncomingMessage;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev
            : [...prev, { id: m.id, body: m.body, fromMe: true, readAt: null, createdAt: m.createdAt }]);
          bumpConversation(a.peer.id, m.body, m.createdAt, true, false);
        }
      });
    } else {
      const gid = a.group.id;
      socket.emit('chat:group-send', { groupId: gid, body: text }, (ack: SendAck) => {
        if (ack?.ok && ack.message) {
          const m = ack.message as IncomingGroupMessage;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev
            : [...prev, { id: m.id, body: m.body, fromMe: true, senderId: myId, senderName: 'You', createdAt: m.createdAt }]);
          bumpConversation(gid, m.body, m.createdAt, true, false);
        }
      });
    }
  }, [bumpConversation, myId]);

  const notifyTyping = useCallback((typing: boolean) => {
    const a = activeRef.current; const socket = socketRef.current;
    if (!a || !socket) return;
    if (a.type === 'dm') socket.emit('chat:typing', { toUserId: a.peer.id, typing });
    else socket.emit('chat:group-typing', { groupId: a.group.id, typing });
    if (typing) {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        const cur = activeRef.current;
        if (!cur) return;
        if (cur.type === 'dm') socketRef.current?.emit('chat:typing', { toUserId: cur.peer.id, typing: false });
        else socketRef.current?.emit('chat:group-typing', { groupId: cur.group.id, typing: false });
      }, 3000);
    }
  }, []);

  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    try {
      const g = await apiFetch<GroupDetail>('/chat/groups', {
        method: 'POST', body: JSON.stringify({ name, memberIds }),
      });
      await refreshConversations();
      setActive({ type: 'group', group: g });
      setMessages([]);
      return true;
    } catch { return false; }
  }, [refreshConversations]);

  const typingNames = Object.values(typingUsers);
  const typingLabel = typingNames.length === 0 ? null
    : active?.type === 'group'
      ? `${typingNames.join(', ')} ${typingNames.length > 1 ? 'are' : 'is'} typing…`
      : 'typing…';

  const value: ChatContextValue = {
    isOpen, open, close, connected, unreadTotal, conversations, directory, canCreateGroups,
    active, messages, loadingMessages, typingLabel,
    selectDm, selectGroup, backToList, send, notifyTyping, createGroup, refreshConversations,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
      {isOpen && <ChatDrawer />}
    </ChatContext.Provider>
  );
}
