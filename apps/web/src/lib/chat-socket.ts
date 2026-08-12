import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';

/** Directory entry — who the current user may message (reuses call directory). */
export interface ChatDirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  online: boolean;
}

interface LastMessage {
  body: string;
  createdAt: string;
  fromMe: boolean;
}

/** Unified conversation row (DM or group) from GET /chat/conversations. */
export type Conversation =
  | {
      type: 'dm';
      id: string;
      peer: { id: string; name: string; avatarUrl: string | null; role: string | null };
      lastMessage: LastMessage;
      unread: number;
      online: boolean;
    }
  | {
      type: 'group';
      id: string;
      group: { id: string; name: string; memberCount: number };
      lastMessage: LastMessage;
      unread: number;
    };

/** A single 1:1 message from GET /chat/messages. */
export interface ChatMessage {
  id: string;
  body: string;
  fromMe: boolean;
  readAt: string | null;
  createdAt: string;
}

/** A single group message (carries sender identity). */
export interface GroupMessage {
  id: string;
  body: string;
  fromMe: boolean;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  online: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  createdById: string;
  members: GroupMember[];
}

/** Server → client push for a 1:1 message (chat:message). */
export interface IncomingMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  body: string;
  createdAt: string;
}

/** Server → client push for a group message (chat:group-message). */
export interface IncomingGroupMessage {
  id: string;
  groupId: string;
  from: string;
  fromName: string;
  body: string;
  createdAt: string;
}

export interface SendAck {
  ok?: boolean;
  message?: IncomingMessage | IncomingGroupMessage;
  error?: string;
}

function getSocketBase(): string {
  return API_BASE.replace(/\/api\/v1\/?$/, '');
}

export function createChatSocket(): Socket {
  return io(`${getSocketBase()}/chat`, { withCredentials: true, autoConnect: true });
}
