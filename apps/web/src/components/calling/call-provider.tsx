'use client';

import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { useToast } from '../ui/toast';
import {
  createCallSocket, CallMedia, CallPeer, CallToken,
  IncomingPayload, AcceptedPayload, CallIdPayload, InviteAck, SimpleAck,
} from '../../lib/call-socket';
import { IncomingCallModal } from './incoming-call-modal';
import { OutgoingCallOverlay } from './outgoing-call-overlay';
import { InCallWindow } from './in-call-window';

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'in-call';

interface CallGroup {
  id: string;
  name: string;
}

interface CallState {
  status: CallStatus;
  callId?: string;
  room?: string;
  media?: CallMedia;
  peer?: CallPeer;
  group?: CallGroup; // set when this is a group call
  token?: string;
  url?: string;
}

interface CallContextValue {
  state: CallState;
  connected: boolean;
  startCall: (callee: CallPeer, media: CallMedia) => void;
  startGroupCall: (groupId: string, media: CallMedia, groupName: string) => void;
  accept: () => void;
  reject: () => void;
  cancel: () => void;
  hangup: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within <CallProvider>');
  return ctx;
}

const IDLE: CallState = { status: 'idle' };

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const userId = session?.user?.id;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<CallState>(IDLE);

  // Latest state for use inside socket handlers (registered once).
  const stateRef = useRef<CallState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const reset = useCallback(() => setState(IDLE), []);

  const emit = useCallback((event: string, payload?: any, ack?: (res: any) => void) => {
    socketRef.current?.emit(event, payload, ack);
  }, []);

  /** Fetch a scoped LiveKit token for the peer and enter the in-call state. */
  const mintAndJoin = useCallback(
    async (peer: CallPeer, media: CallMedia, callId: string, room: string) => {
      setState({ status: 'connecting', peer, media, callId, room });
      try {
        const res = await apiFetch<CallToken>('/calls/token', {
          method: 'POST',
          body: JSON.stringify({ calleeId: peer.id, media }),
        });
        setState({
          status: 'in-call', peer, media, callId,
          room: res.room, token: res.token, url: res.url,
        });
      } catch (e: any) {
        toast('error', e?.message || 'Could not connect the call');
        reset();
      }
    },
    [toast, reset],
  );

  /** Mint a group-scoped token and join the shared group room. */
  const mintGroupAndJoin = useCallback(
    async (group: CallGroup, media: CallMedia) => {
      setState({ status: 'connecting', group, media });
      try {
        const res = await apiFetch<CallToken>('/calls/group-token', {
          method: 'POST',
          body: JSON.stringify({ groupId: group.id, media }),
        });
        setState({
          status: 'in-call', group, media,
          room: res.room, token: res.token, url: res.url,
        });
      } catch (e: any) {
        toast('error', e?.message || 'Could not join the group call');
        reset();
      }
    },
    [toast, reset],
  );

  // ─── Socket lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const socket = createCallSocket();
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('call:incoming', (p: IncomingPayload) => {
      // Busy → auto-reject a second inbound call.
      if (stateRef.current.status !== 'idle') {
        socket.emit('call:reject', { callId: p.callId });
        return;
      }
      setState({
        status: 'incoming', callId: p.callId, room: p.room,
        media: p.media, peer: p.from,
      });
    });

    socket.on('call:group-incoming', (p: {
      groupId: string; groupName: string; room: string; media: CallMedia; from: CallPeer;
    }) => {
      if (stateRef.current.status !== 'idle') return; // busy → ignore group ring
      setState({
        status: 'incoming', room: p.room, media: p.media,
        peer: p.from, group: { id: p.groupId, name: p.groupName },
      });
    });

    socket.on('call:accepted', (_p: AcceptedPayload) => {
      const s = stateRef.current;
      if (s.status === 'outgoing' && s.peer && s.media && s.callId && s.room) {
        void mintAndJoin(s.peer, s.media, s.callId, s.room);
      }
    });

    socket.on('call:rejected', (_p: CallIdPayload) => {
      toast('info', 'Call declined');
      reset();
    });

    socket.on('call:cancelled', (_p: CallIdPayload) => {
      reset();
    });

    socket.on('call:ended', (_p: CallIdPayload) => {
      reset();
    });

    socket.on('call:timeout', (_p: CallIdPayload) => {
      if (stateRef.current.status === 'outgoing') toast('info', 'No answer');
      reset();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId, mintAndJoin, reset, toast]);

  // ─── Actions ───────────────────────────────────────────────────────────
  const startCall = useCallback((callee: CallPeer, media: CallMedia) => {
    if (stateRef.current.status !== 'idle') return;
    emit('call:invite', { calleeId: callee.id, media }, (ack: InviteAck) => {
      if (ack?.error) { toast('error', ack.error); return; }
      if (ack?.status === 'missed') {
        toast('info', `${callee.name} is offline`);
        return;
      }
      if (ack?.status === 'ringing' && ack.callId && ack.room) {
        setState({ status: 'outgoing', callId: ack.callId, room: ack.room, media, peer: callee });
      }
    });
  }, [emit, toast]);

  const startGroupCall = useCallback((groupId: string, media: CallMedia, groupName: string) => {
    if (stateRef.current.status !== 'idle') return;
    const group = { id: groupId, name: groupName };
    // Ring the other members, then join the room right away as the initiator.
    emit('call:group-invite', { groupId, media }, (ack: any) => {
      if (ack?.error) { toast('error', ack.error); return; }
    });
    void mintGroupAndJoin(group, media);
  }, [emit, mintGroupAndJoin, toast]);

  const accept = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'incoming') return;
    // Group call → just join the room (no per-callee accept handshake).
    if (s.group && s.media) {
      void mintGroupAndJoin(s.group, s.media);
      return;
    }
    if (!s.callId || !s.peer || !s.media || !s.room) return;
    const { callId, peer, media, room } = s;
    emit('call:accept', { callId }, (ack: SimpleAck) => {
      if (ack?.error) { toast('error', ack.error); reset(); return; }
      void mintAndJoin(peer, media, callId, room);
    });
  }, [emit, mintAndJoin, mintGroupAndJoin, toast, reset]);

  const reject = useCallback(() => {
    const s = stateRef.current;
    if (s.callId) emit('call:reject', { callId: s.callId });
    reset();
  }, [emit, reset]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    if (s.callId) emit('call:cancel', { callId: s.callId });
    reset();
  }, [emit, reset]);

  const hangup = useCallback(() => {
    const s = stateRef.current;
    if (s.group) emit('call:group-leave', { groupId: s.group.id });
    else if (s.callId) emit('call:end', { callId: s.callId });
    reset();
  }, [emit, reset]);

  const value: CallContextValue = {
    state, connected, startCall, startGroupCall, accept, reject, cancel, hangup,
  };

  return (
    <CallContext.Provider value={value}>
      {children}

      {state.status === 'incoming' && state.peer && (
        <IncomingCallModal
          peer={state.peer}
          media={state.media ?? 'AUDIO'}
          groupName={state.group?.name}
          onAccept={accept}
          onReject={reject}
        />
      )}

      {(state.status === 'outgoing' || state.status === 'connecting') && state.peer && (
        <OutgoingCallOverlay
          peer={state.peer}
          media={state.media ?? 'AUDIO'}
          connecting={state.status === 'connecting'}
          onCancel={cancel}
        />
      )}

      {state.status === 'in-call' && state.token && state.url && (
        <InCallWindow
          url={state.url}
          token={state.token}
          video={state.media === 'VIDEO'}
          peerName={state.group?.name ?? state.peer?.name ?? ''}
          onLeave={hangup}
        />
      )}
    </CallContext.Provider>
  );
}
