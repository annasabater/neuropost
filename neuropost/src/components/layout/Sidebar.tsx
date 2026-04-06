'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProgressLink } from '@/components/ui/ProgressLink';
import {
  LayoutDashboard,
  Lightbulb,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  X,
  Image,
  Palette,
  Grid3x3,
  Archive,
  MessageCircle,
  ClipboardList,
  LifeBuoy,
  Sparkles,
  Flame,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';

export function Sidebar() {
  const pathname      = usePathname();
  const router        = useRouter();
  const t             = useTranslations('nav');
  const brand         = useAppStore((s) => s.brand);
  const sidebarOpen   = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadComments      = useAppStore((s) => s.unreadComments);
  const unreadNotifications = useAppStore((s) => s.unreadNotifications);

  const NAV_GROUPS = [
    {
      title: t('groups.content'),
      items: [
        { href: '/dashboard', label: t('dashboard'),   icon: LayoutDashboard },
        { href: '/posts',     label: t('posts'),        icon: Image },
        { href: '/calendar',  label: t('calendar'),     icon: Calendar },
        { href: '/ideas',     label: t('ideas'),        icon: Lightbulb },
        { href: '/mi-feed',   label: t('myFeed'),       icon: Grid3x3 },
        { href: '/inspiracion', label: t('inspiration'), icon: Flame },
      ],
    },
    {
      title: t('groups.management'),
      items: [
        { href: '/comments',  label: t('comments'),    icon: MessageSquare },
        { href: '/analytics', label: t('analytics'),   icon: BarChart3 },
        { href: '/historial', label: t('history'),     icon: Archive },
        { href: '/novedades', label: t('news'),        icon: Sparkles },
      ],
    },
    {
      title: t('groups.team'),
      items: [
        { href: '/chat',        label: t('chat'),      icon: MessageCircle },
        { href: '/solicitudes', label: t('requests'),  icon: ClipboardList },
        { href: '/soporte',     label: t('support'),   icon: LifeBuoy },
      ],
    },
    {
      title: t('groups.brand'),
      items: [
        { href: '/brand',    label: t('brandKit'), icon: Palette },
        { href: '/settings', label: t('settings'), icon: Settings },
      ],
    },
  ];

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-header">
        <ProgressLink href="/dashboard" className="dash-logo">NeuroPost</ProgressLink>
        <button className="sidebar-close-btn" onClick={toggleSidebar} aria-label={t('settings')}>
          <X size={18} />
        </button>
      </div>

      <div className="dash-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a4257', letterSpacing: '0.1em', padding: '8px 10px 2px' }}>
              {group.title}
            </div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              const badge  = href === '/comments'      ? unreadComments
                           : href === '/notifications' ? unreadNotifications
                           : 0;
              return (
                <ProgressLink
                  key={href}
                  href={href}
                  className={`dash-nav-item${active ? ' active' : ''}`}
                  onClick={() => { if (sidebarOpen) toggleSidebar(); }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {badge > 0 && <span className="nav-badge">{badge}</span>}
                </ProgressLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar utility footer links */}
      <div style={{ flexShrink: 0, padding: '4px 16px 2px', borderTop: '1px solid #1a1d2e' }}>
        <a href="/estado" target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', fontSize: '0.68rem', color: '#3a4257', textDecoration: 'none', padding: '2px 0', lineHeight: 1.4 }}>
          {t('statusPage')}
        </a>
        <ProgressLink href="/novedades"
          style={{ display: 'block', fontSize: '0.68rem', color: '#3a4257', textDecoration: 'none', padding: '2px 0', lineHeight: 1.4 }}
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}>
          {t('news')}
        </ProgressLink>
        <ProgressLink href="/soporte"
          style={{ display: 'block', fontSize: '0.68rem', color: '#3a4257', textDecoration: 'none', padding: '2px 0', lineHeight: 1.4 }}
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}>
          {t('support')}
        </ProgressLink>
      </div>

      <div className="dash-sidebar-footer">
        {brand && (
          <div className="dash-brand-pill">
            <span className="dash-brand-name">{brand.name}</span>
            <span className={`plan-badge plan-${brand.plan}`}>{brand.plan}</span>
          </div>
        )}
        <button className="dash-logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
