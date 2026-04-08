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
            borderRadius: 'var(--r-full)',
            background:  nearLimit ? 'var(--red-dim)' : 'var(--surface-2)',
            border:      `1px solid ${nearLimit ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
            fontSize:    '12px',
            fontFamily:  "'Syne', 'Cabinet Grotesk', sans-serif",
            fontWeight:  600,
            color:       nearLimit ? 'var(--red)' : 'var(--text-2)',
            cursor:      'default',
          }}
        >
          <div style={{ width: 56, height: 3, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${pct}%`,
              borderRadius: 2,
              background:  pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'linear-gradient(90deg, var(--orange), #ff8c42)',
              transition:  'width 0.3s ease',
            }} />
          </div>
          <span>{used}/{limit}</span>
          {nearLimit && (
            <Link href="/settings/plan" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 700, fontSize: '11px' }}>
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