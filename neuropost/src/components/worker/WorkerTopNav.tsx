'use client';

import { Menu, Bell } from 'lucide-react';
import { ProgressLink } from '@/components/ui/ProgressLink';
import { getWorkerRouteLabel } from '@/components/worker/navigation';
import type { Worker } from '@/types';

interface WorkerTopNavProps {
  pathname: string;
  worker: Worker | null;
  queueBadge: number;
  msgBadge: number;
  onToggleSidebar: () => void;
}

export function WorkerTopNav({
  pathname,
  worker,
  queueBadge,
  msgBadge,
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

        <span className="worker-topbar-user">{worker?.full_name?.split(' ')[0] ?? 'Equipo'}</span>
        {worker?.role && <span className="worker-topbar-role">{worker.role}</span>}
      </div>
    </header>
  );
}
