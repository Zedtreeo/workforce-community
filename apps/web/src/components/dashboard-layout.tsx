'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { AuthProvider } from './auth-provider';
import { ToastProvider } from './ui/toast';
import { KbSearchWidget } from './kb-search-widget';
import { DemoContactBanner } from './demo-contact-banner';
import { DemoReadOnlyToast } from './demo-readonly-toast';
import { CallProvider } from './calling/call-provider';
import { ChatProvider } from './chat/chat-provider';
import { PushNotifications } from './push-notifications';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <CallProvider>
         <ChatProvider>
          <DemoReadOnlyToast />
          <PushNotifications />
          <div className="flex min-h-screen bg-surface-50">
            <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
              <Header onMenuClick={() => setMobileOpen(true)} />
              <main className="flex-1 overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
                {children}
              </main>
              <KbSearchWidget />
              <DemoContactBanner variant="footer" />
            </div>
          </div>
         </ChatProvider>
        </CallProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
