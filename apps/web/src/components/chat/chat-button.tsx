'use client';

import { MessageCircle } from 'lucide-react';
import { useChat } from './chat-provider';

/** Header entry point for chat: icon + unread badge, opens the drawer. */
export function ChatButton() {
  const { open, unreadTotal } = useChat();
  return (
    <button
      onClick={() => open()}
      title="Messages"
      className="relative h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors"
    >
      <MessageCircle size={18} />
      {unreadTotal > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unreadTotal > 9 ? '9+' : unreadTotal}
        </span>
      )}
    </button>
  );
}
