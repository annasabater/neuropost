'use client';

import { Menu, Bell } from 'lucide-react';
import { ProgressLink } from '@/components/ui/ProgressLink';
import { getWorkerRouteLabel } from '@/components/worker/navigation';

interface WorkerTopNavProps {
  pathname: string;
  onToggleSidebar: () => void;
}

export function WorkerTopNav({
  pathname,
  onToggleSidebar,
}: WorkerTopNavProps) {
  const title = getWorkerRouteLabel(pathname);

  return (
    <header className="dash-topbar worker-topbar">
      <button className="sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      <div className="worker-topbar-context">
        <span className="worker-topbar-title">{title}</span>
      </div>

      <div className="topbar-actions">
        <ProgressLink href="/worker/inbox" className="topbar-icon-btn" aria-label="Inbox" title="Inbox">
          <Bell size={18} />
        </ProgressLink>
      </div>
    </header>
  );
}
