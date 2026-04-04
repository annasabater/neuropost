'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Bell, Menu, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

export function TopNav() {
  const toggleSidebar       = useAppStore((s) => s.toggleSidebar);
  const unreadNotifications = useAppStore((s) => s.unreadNotifications);
  const brand               = useAppStore((s) => s.brand);
  const posts               = useAppStore((s) => s.posts);
  const monthlyPostCount    = useAppStore((s) => s.monthlyPostCount);

  const plan       = brand?.plan ?? 'starter';
  const limit      = PLAN_LIMITS[plan].postsPerMonth;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const used       = useMemo(() => monthlyPostCount(), [posts]);
  const isUnlimited = limit === Infinity;
  const pct        = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit  = !isUnlimited && pct >= 80;

  return (
    <header className="dash-topbar">
      <button className="sidebar-toggle-btn" onClick={toggleSidebar} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      {/* Plan usage pill — only for starter */}
      {!isUnlimited && brand && (
        <div
          title={`${used} de ${limit} posts publicados este mes`}
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         8,
            padding:     '5px 12px',
            borderRadius: 20,
            background:  nearLimit ? '#fef2f2' : 'var(--surface)',
            border:      `1px solid ${nearLimit ? '#fca5a5' : 'var(--border)'}`,
            fontSize:    '0.78rem',
            fontFamily:  "'Cabinet Grotesk', sans-serif",
            fontWeight:  600,
            color:       nearLimit ? '#dc2626' : 'var(--muted)',
            cursor:      'default',
          }}
        >
          <div style={{ width: 56, height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${pct}%`,
              borderRadius: 4,
              background:  pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : 'var(--orange)',
              transition:  'width 0.3s ease',
            }} />
          </div>
          <span>{used}/{limit} posts</span>
          {nearLimit && (
            <Link href="/settings/plan" style={{ color: '#dc2626', textDecoration: 'none', fontWeight: 700 }}>
              Ampliar →
            </Link>
          )}
        </div>
      )}

      <div className="topbar-actions">
        <Link href="/posts/new" className="btn-primary btn-orange topbar-new-btn">
          <Plus size={16} />
          <span>Nuevo post</span>
        </Link>

        <LanguageSelector />
        <ThemeToggle />

        <Link href="/notifications" className="topbar-icon-btn" aria-label="Notificaciones">
          <Bell size={18} />
          {unreadNotifications > 0 && (
            <span className="topbar-badge">{unreadNotifications}</span>
          )}
        </Link>
      </div>
    </header>
  );
}