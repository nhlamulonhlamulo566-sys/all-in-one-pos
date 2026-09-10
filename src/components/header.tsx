 'use client';

import { useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';

type HeaderStatus = 'Online' | 'Offline' | 'Online - Locked' | 'Offline - Locked';

export function Header() {
  const [status, setStatus] = useState<HeaderStatus>('Online');
  const auth = useAuth();

  useEffect(() => {
    const updateStatus = async () => {
      if (window.electronAPI?.getTerminalStatus) {
        const terminal = await window.electronAPI.getTerminalStatus();
        setStatus(terminal.lockState === 'locked'
          ? terminal.online ? 'Online - Locked' : 'Offline - Locked'
          : terminal.online ? 'Online' : 'Offline');
        if (terminal.online && terminal.lockState === 'unlocked' && window.electronAPI.syncOfflineSales && auth?.currentUser) {
          await window.electronAPI.syncOfflineSales({ idToken: await auth.currentUser.getIdToken(true) });
        }
        return;
      }
      setStatus(navigator.onLine ? 'Online' : 'Offline');
    };
    void updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    const interval = window.setInterval(updateStatus, 30000);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.clearInterval(interval);
    };
  }, [auth?.currentUser]);

  return (
    <div className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="w-full flex-1">
        {/* Search form has been removed */}
      </div>
      <Badge variant={status.includes('Locked') ? 'destructive' : 'secondary'}>{status}</Badge>
      <UserNav />
    </div>
  );
}
