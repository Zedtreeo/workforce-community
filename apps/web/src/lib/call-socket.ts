import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';

export type CallMedia = 'AUDIO' | 'VIDEO';

export interface CallPeer {
  id: string;
  name: string;
}

/** Directory entry returned by GET /calls/directory. */
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  online: boolean;
}

// ─── Server → client event payloads ────────────────────────────────────
export interface IncomingPayload {
  callId: string;
  room: string;
  media: CallMedia;
  from: CallPeer;
}
export interface AcceptedPayload {
  callId: string;
  room: string;
}
export interface CallIdPayload {
  callId: string;
}

// ─── Client → server ack shapes ─────────────────────────────────────────
export interface InviteAck {
  callId?: string;
  room?: string;
  status?: 'ringing' | 'missed';
  reason?: string;
  error?: string;
}
export interface SimpleAck {
  ok?: boolean;
  room?: string;
  error?: string;
}

/** Token response from POST /calls/token. */
export interface CallToken {
  token: string;
  url: string;
  room: string;
  media: CallMedia;
}

/** One row from GET /calls (enriched history). */
export interface CallHistoryEntry {
  id: string;
  media: CallMedia;
  status: 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'MISSED' | 'ENDED';
  direction: 'incoming' | 'outgoing';
  peer: { id: string; name: string; avatarUrl: string | null };
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
}

function getSocketBase(): string {
  // API_BASE looks like https://host/api/v1 — the Socket.IO server lives at the
  // origin, under the /calls namespace.
  return API_BASE.replace(/\/api\/v1\/?$/, '');
}

export function createCallSocket(): Socket {
  return io(`${getSocketBase()}/calls`, {
    withCredentials: true,
    autoConnect: true,
  });
}
