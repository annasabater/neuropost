'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ProgressLink } from '@/components/ui/ProgressLink';
import { getWorkerNavGroups, isWorkerRouteActive } from '@/components/worker/navigation';
import {
  LogOut,
  X,
  ChevronDown,
} from 'lucide-react';
import type { Worker } from '@/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";

interface WorkerSidebarProps {
  pathname: string;
  worker: Worker | null;
  queueBadge: number;
  msgBadge: number;
  onClose: () => void;
  onLogout: () => Promise<void>;
}

export function WorkerSidebar({
  pathname,
  worker,
  queueBadge,
  msgBadge,
  onClose,
  onLogout,
}: WorkerSidebarProps) {
  const groups = getWorkerNavGroups(worker?.role);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }) {
    const active = isWorkerRouteActive(pathname, href);
    return (
      <ProgressLink href={href} className={`dash-nav-item${active ? ' active' : ''}`} onClick={onClose}>
        <Icon size={15} />
        <span>{label}</span>
        {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
      </ProgressLink>
    );
  }

  return (
    <aside className="dash-sidebar">
      {/* ── Header ── */}
      <div className="dash-sidebar-header">
        <ProgressLink href="/worker" className="dash-logo">NeuroPost</ProgressLink>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      {/* ── Navigation ── */}
      <div className="dash-nav">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Contenido */}
            <div className="dash-nav-group-label">{group.label}</div>
            {group.items.map(({ href, icon: Icon, label, badge }) => {
              const badgeCount = badge === 'queue' ? queueBadge : badge === 'msg' ? msgBadge : 0;
              return (
                <NavItem key={href} href={href} label={label} icon={Icon} badge={badgeCount > 0 ? badgeCount : undefined} />
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Profile section ── */}
      <div ref={profileRef} className="dash-sidebar-footer" style={{ position: 'relative' }}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 10px', background: 'none', border: 'none', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 28, height: 28, background: '#f3f4f6', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: f, fontSize: 11, fontWeight: 700, color: '#6b7280', flexShrink: 0,
          }}>
            {worker?.full_name?.charAt(0)?.toUpperCase() ?? 'W'}
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <p style={{ fontFamily: f, fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {worker?.full_name ?? 'Worker'}
            </p>
            <p style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', margin: 0, textTransform: 'capitalize' }}>
              {worker?.role ?? 'equipo'}
            </p>
          </div>
          <ChevronDown size={12} style={{ color: '#9ca3af', flexShrink: 0, transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {/* Profile dropdown */}
        {profileOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
            background: '#ffffff', border: '1px solid #e5e7eb', zIndex: 100,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
          }}>
            <button onClick={() => void onLogout()} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontFamily: f, fontSize: 13, fontWeight: 500,
              transition: 'background 0.1s',
            }}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
