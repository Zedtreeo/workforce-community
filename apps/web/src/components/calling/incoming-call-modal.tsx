'use client';

import { Phone, PhoneOff, Video } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import type { CallMedia, CallPeer } from '../../lib/call-socket';
import { useRingtone } from './use-ringtone';

interface Props {
  peer: CallPeer;
  media: CallMedia;
  groupName?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ peer, media, groupName, onAccept, onReject }: Props) {
  useRingtone(true);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" />

      <div className="relative bg-white rounded-2xl shadow-overlay w-full max-w-sm mx-4 p-6 animate-slide-up text-center">
        <p className="text-xs font-medium text-content-tertiary uppercase tracking-wide">
          {groupName ? 'Incoming group' : 'Incoming'} {media === 'VIDEO' ? 'video' : 'audio'} call
        </p>

        <div className="flex flex-col items-center gap-3 mt-5">
          <div className="relative">
            <Avatar name={groupName ?? peer.name} size="lg" />
            <span className="absolute inset-0 rounded-full ring-4 ring-brand-400/40 animate-ping" />
          </div>
          <h2 className="text-lg font-semibold text-content-primary">{groupName ?? peer.name}</h2>
          {groupName && <p className="text-sm text-content-tertiary -mt-1">{peer.name} is calling</p>}
        </div>

        <div className="flex items-center justify-center gap-6 mt-7">
          <button
            onClick={onReject}
            className="flex flex-col items-center gap-1.5 group"
            title="Decline"
          >
            <span className="h-14 w-14 rounded-full bg-danger text-white flex items-center justify-center group-hover:bg-red-600 transition-colors shadow-sm">
              <PhoneOff size={22} />
            </span>
            <span className="text-xs text-content-tertiary">Decline</span>
          </button>

          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-1.5 group"
            title="Accept"
          >
            <span className="h-14 w-14 rounded-full bg-success text-white flex items-center justify-center group-hover:bg-emerald-600 transition-colors shadow-sm">
              {media === 'VIDEO' ? <Video size={22} /> : <Phone size={22} />}
            </span>
            <span className="text-xs text-content-tertiary">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
