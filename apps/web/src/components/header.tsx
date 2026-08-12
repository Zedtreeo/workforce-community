'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '../lib/auth-client';
import { apiFetch } from '../lib/api';
import { Bell, LogOut, Search, Menu } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.session?.id) return;
    try {
      const data = await apiFetch<{ unreadCount: number }>('/notifications/unread-count');
      setUnreadCount(data.unreadCount);
    } catch {}
  }, [session]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDropdown = async () => {
    if (showDropdown) { setShowDropdown(false); return; }
    setShowDropdown(true);
    setLoadingNotifs(true);
    try {
      const data = await apiFetch<{ data: Notification[] }>('/notifications?limit=10');
      setNotifications(data.data);
    } catch {} finally { setLoadingNotifs(false); }
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) markRead(notif.id);
    if (notif.linkUrl) { router.push(notif.linkUrl); setShowDropdown(false); }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>

        {/* Search — hidden on mobile, shown md+ */}
        <div className="relative w-72 hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-surface-50 border border-surface-200 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile search icon */}
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors md:hidden">
          <Search size={18} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={openDropdown}
            className="relative h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="fixed inset-x-3 top-16 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] bg-white rounded-xl shadow-overlay border border-surface-200 z-50 max-h-[480px] flex flex-col animate-slide-down">
              <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-content-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {loadingNotifs ? (
                  <div className="text-center py-8 text-content-tertiary text-sm">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-content-tertiary text-sm">No notifications</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`px-4 py-3 border-b border-surface-100 cursor-pointer hover:bg-surface-50 transition-colors ${
                        !notif.isRead ? 'bg-brand-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!notif.isRead && <span className="w-2 h-2 bg-brand-500 rounded-full mt-1.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notif.isRead ? 'font-semibold text-content-primary' : 'font-medium text-content-secondary'}`}>{notif.title}</p>
                          <p className="text-xs text-content-tertiary mt-0.5 truncate">{notif.message}</p>
                          <p className="text-[10px] text-content-tertiary mt-1">{timeAgo(notif.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-surface-200 hidden sm:block" />

        {/* User — hidden on xs */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-content-primary leading-none">{session?.user?.name}</p>
          <p className="text-[11px] text-content-tertiary capitalize mt-0.5">{(session?.user as any)?.role?.toLowerCase()}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
