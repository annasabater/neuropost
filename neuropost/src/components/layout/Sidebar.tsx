'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProgressLink } from '@/components/ui/ProgressLink';
import {
  LayoutDashboard, Lightbulb, Calendar, MessageSquare, BarChart3,
  Settings, LogOut, X, Image, Palette, Grid3x3, Archive,
  MessageCircle, ClipboardList, LifeBuoy, Sparkles, Flame,
  Plus, ChevronDown, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const brand = useAppStore((s) => s.brand);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadComments = useAppStore((s) => s.unreadComments);

  const [moreOpen, setMoreOpen] = useState(false);
  const [gestionOpen, setGestionOpen] = useState(true);

  // Primary nav — always visible
  const PRIMARY = [
    { href: '/dashboard',   label: t('dashboard'),    icon: LayoutDashboard },
    { href: '/posts',       label: t('posts'),         icon: Image },
    { href: '/calendar',    label: t('calendar'),      icon: Calendar },
    { href: '/ideas',       label: t('ideas'),         icon: Lightbulb },
    { href: '/mi-feed',     label: t('myFeed'),        icon: Grid3x3 },
    { href: '/inspiracion', label: t('inspiration'),   icon: Flame },
  ];

  // User section
  const USER = [
    { href: '/chat',        label: t('chat'),      icon: MessageCircle },
    { href: '/solicitudes', label: t('requests'),  icon: ClipboardList },
  ];

  // Management — collapsible
  const GESTION = [
    { href: '/comments',  label: t('comments'),  icon: MessageSquare },
    { href: '/analytics', label: t('analytics'), icon: BarChart3 },
    { href: '/historial', label: t('history'),   icon: Archive },
  ];

  // More — secondary
  const MORE = [
    { href: '/novedades', label: t('news'),     icon: Sparkles },
    { href: '/soporte',   label: t('support'),  icon: LifeBuoy },
    { href: '/brand',     label: t('brandKit'), icon: Palette },
  ];

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }) {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return (
      <ProgressLink
        href={href}
        className={`dash-nav-item${active ? ' active' : ''}`}
        onClick={() => { if (sidebarOpen) toggleSidebar(); }}
      >
        <Icon size={14} />
        <span>{label}</span>
        {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
      </ProgressLink>
    );
  }

  return (
    <aside className="dash-sidebar">
      {/* Header */}
      <div className="dash-sidebar-header">
        <ProgressLink href="/dashboard" className="dash-logo">NeuroPost</ProgressLink>
        <button className="sidebar-close-btn" onClick={toggleSidebar} aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      <div className="dash-nav">
        {/* ── CONTENIDO ── */}
        <div className="dash-nav-group-label">Contenido</div>
        {PRIMARY.map((item) => <NavItem key={item.href} {...item} />)}

        {/* ── USUARIO ── */}
        <div className="dash-nav-group-label" style={{ marginTop: 8 }}>Personal</div>
        {USER.map((item) => <NavItem key={item.href} {...item} />)}

        {/* ── GESTIÓN — collapsible ── */}
        <button
          onClick={() => setGestionOpen(!gestionOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, width: '100%',
            padding: '12px 10px 4px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: f, fontSize: 10, fontWeight: 600, color: '#9ca3af',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}
        >
          {gestionOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Gestión
        </button>
        {gestionOpen && GESTION.map((item) => (
          <NavItem key={item.href} {...item} badge={item.href === '/comments' ? unreadComments : undefined} />
        ))}

        {/* ── MÁS — collapsible ── */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, width: '100%',
            padding: '12px 10px 4px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: f, fontSize: 10, fontWeight: 600, color: '#9ca3af',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}
        >
          {moreOpen ? <ChevronDown size={10} /> : <MoreHorizontal size={10} />}
          Más
        </button>
        {moreOpen && MORE.map((item) => <NavItem key={item.href} {...item} />)}
      </div>

      {/* New post button */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <ProgressLink
          href="/posts/new"
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 12px', background: '#111827', color: '#ffffff',
            textDecoration: 'none', fontFamily: f, fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em', width: '100%',
          }}
        >
          <Plus size={14} /> Nuevo post
        </ProgressLink>
      </div>

      {/* Footer — Settings */}
      <div className="dash-sidebar-footer">
        <ProgressLink
          href="/settings"
          className={`dash-nav-item${pathname.startsWith('/settings') ? ' active' : ''}`}
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}
          style={{ margin: 0 }}
        >
          <Settings size={14} />
          <span>{t('settings')}</span>
        </ProgressLink>
      </div>
    </aside>
  );
}
