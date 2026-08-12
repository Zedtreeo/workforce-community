'use client';

import { PhoneOff } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import type { CallMedia, CallPeer } from '../../lib/call-socket';

interface Props {
  peer: CallPeer;
  media: CallMedia;
  connecting: boolean;
  onCancel: () => void;
}

export function OutgoingCallOverlay({ peer, media, connecting, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" />

      <div className="relative bg-white rounded-2xl shadow-overlay w-full max-w-sm mx-4 p-6 animate-slide-up text-center">
        <p className="text-xs font-medium text-content-tertiary uppercase tracking-wide">
          {connecting ? 'Connecting…' : `Calling · ${media === 'VIDEO' ? 'video' : 'audio'}`}
        </p>

        <div className="flex flex-col items-center gap-3 mt-5">
          <Avatar name={peer.name} size="lg" />
          <h2 className="text-lg font-semibold text-content-primary">{peer.name}</h2>
          <span className="text-sm text-content-tertiary animate-pulse">
            {connecting ? 'Setting up the call…' : 'Ringing…'}
          </span>
        </div>

        <div className="flex items-center justify-center mt-7">
          <button
            onClick={onCancel}
            className="flex flex-col items-center gap-1.5 group"
            title="Cancel"
          >
            <span className="h-14 w-14 rounded-full bg-danger text-white flex items-center justify-center group-hover:bg-red-600 transition-colors shadow-sm">
              <PhoneOff size={22} />
            </span>
            <span className="text-xs text-content-tertiary">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
