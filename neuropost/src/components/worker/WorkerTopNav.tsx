'use client';

import { useEffect, useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { ProgressLink } from '@/components/ui/ProgressLink';
import { getWorkerRouteLabel } from '@/components/worker/navigation';
import { usePathname } from 'next/navigation';

interface WorkerTopNavProps {
  pathname: string;
  onToggleSidebar: () => void;
}

export function WorkerTopNav({
  pathname,
  onToggleSidebar,
}: WorkerTopNavProps) {
  const title = getWorkerRouteLabel(pathname);
  const currentPath = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch('/api/worker/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.notifications ?? []).filter((n: { read: boolean }) => !n.read).length;
        setUnread(count);
      } catch { /* ignore */ }
    }
    fetchUnread();
    // Re-fetch when navigating to keep count fresh
  }, [currentPath]);

  return (
    <header className="dash-topbar worker-topbar">
      <button type="button" className="sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      <div className="worker-topbar-context">
        <span className="worker-topbar-title">{title}</span>
      </div>

      <div className="topbar-actions">
        <ProgressLink
          href="/worker/inbox"
          className="topbar-icon-btn"
          aria-label="Inbox"
          title="Inbox"
          style={{ position: 'relative', display: 'inline-flex' }}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </ProgressLink>
      </div>
    </header>
  );
}
