'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProgressLink } from '@/components/ui/ProgressLink';
import {
  LayoutDashboard, Image, Flame, Calendar, Upload, Camera,
  BarChart3, Archive, MessageSquare, Lightbulb,
  Settings, LogOut, ChevronDown, Palette, Plus, X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';
import { PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type NavGroup = {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }[];
};

export function Sidebar() {
  const pathname        = usePathname();
  const t               = useTranslations('nav');
  const brand           = useAppStore((s) => s.brand);
  const sidebarOpen     = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar   = useAppStore((s) => s.toggleSidebar);
  const unreadComments  = useAppStore((s) => s.unreadComments);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeAndNav = () => { if (sidebarOpen) toggleSidebar(); setProfileOpen(false); };

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const NAV_GROUPS: NavGroup[] = [
    {
      label: '',
      items: [
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
      ],
    },
    {
      label: 'Contenido',
      items: [
        { href: '/posts',      label: t('posts'),       icon: Image },
        { href: '/ideas',      label: 'Ideas',           icon: Lightbulb },
        { href: '/inspiracion',label: t('inspiration'),  icon: Flame },
        { href: '/calendar',   label: t('calendar'),     icon: Calendar },
      ],
    },
    {
      label: 'Comunidad',
      items: [
        { href: '/inbox',    label: 'Inbox',    icon: MessageSquare, badge: unreadComments },
        { href: '/historial',label: t('history'), icon: Archive },
      ],
    },
    {
      label: 'Marca',
      items: [
        { href: '/biblioteca', label: 'Biblioteca', icon: Upload },
        { href: '/feed',       label: 'Feed',        icon: Camera },
      ],
    },
    {
      label: 'Analítica',
      items: [
        { href: '/analytics', label: t('analytics'), icon: BarChart3 },
      ],
    },
  ];

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }) {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return (
      <ProgressLink
        href={href}
        onClick={closeAndNav}
        className={`ig-nav-item${active ? ' active' : ''}`}
      >
        <span className="ig-nav-icon"><Icon size={18} /></span>
        <span className="ig-nav-label">{label}</span>
        {badge != null && badge > 0 && (
          <span className="nav-badge">{badge}</span>
        )}
      </ProgressLink>
    );
  }

  return (
    <aside className={`ig-sidebar${sidebarOpen ? ' open' : ''}`}>

      {/* ── Header ── */}
      <div className="ig-sidebar-header">
        <ProgressLink href="/dashboard" className="ig-logo" onClick={closeAndNav}>
          <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
            Neuro<span style={{ color: 'var(--accent)' }}>Post</span>
          </span>
        </ProgressLink>
        <button className="ig-sidebar-close" onClick={toggleSidebar} aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      {/* ── Create button ── */}
      <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
        <ProgressLink
          href="/posts/new"
          onClick={closeAndNav}
          className="ig-create-btn"
        >
          <Plus size={15} />
          <span>Crear post</span>
        </ProgressLink>
      </div>

      {/* ── Navigation ── */}
      <nav className="ig-nav">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="ig-nav-group">
            {group.label && (
              <p className="ig-nav-group-label">{group.label}</p>
            )}
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Profile footer ── */}
      <div ref={profileRef} className="ig-sidebar-footer">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="ig-profile-btn"
        >
          <div className="ig-avatar">
            {brand?.name?.charAt(0).toUpperCase() ?? 'N'}
          </div>
          <div className="ig-profile-info">
            <p className="ig-profile-name">{brand?.name ?? 'Mi negocio'}</p>
            <p className="ig-profile-plan">
              {PLAN_META[(brand?.plan ?? 'starter') as SubscriptionPlan]?.label ?? 'Esencial'}
            </p>
          </div>
          <ChevronDown
            size={12}
            style={{
              color: 'var(--text-tertiary)', flexShrink: 0,
              transform: profileOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        </button>

        {profileOpen && (
          <div className="ig-profile-dropdown">
            {[
              { href: '/brand',    label: 'Brand Kit', icon: Palette },
              { href: '/settings', label: 'Ajustes',   icon: Settings },
            ].map(({ href, label, icon: Icon }) => (
              <ProgressLink key={href} href={href} onClick={closeAndNav} className="ig-dropdown-item">
                <Icon size={14} style={{ color: 'var(--text-tertiary)' }} />
                {label}
              </ProgressLink>
            ))}
            <button onClick={handleLogout} className="ig-dropdown-item ig-dropdown-logout">
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Bottom navigation for mobile ──────────────────────────────────────────────
export function BottomNav() {
  const pathname       = usePathname();
  const unreadComments = useAppStore((s) => s.unreadComments);

  const BOTTOM_ITEMS = [
    { href: '/dashboard',  label: 'Inicio',    icon: LayoutDashboard },
    { href: '/posts',      label: 'Posts',     icon: Image },
    { href: '/inspiracion',label: 'Inspirar',  icon: Flame },
    { href: '/inbox',      label: 'Inbox',     icon: MessageSquare, badge: unreadComments },
    { href: '/analytics',  label: 'Stats',     icon: BarChart3 },
  ];

  return (
    <nav className="ig-bottom-nav">
      {BOTTOM_ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <ProgressLink key={href} href={href} className={`ig-bottom-item${active ? ' active' : ''}`}>
            <span className="ig-bottom-icon">
              <Icon size={22} />
              {badge != null && badge > 0 && <span className="ig-bottom-badge">{badge}</span>}
            </span>
            <span className="ig-bottom-label">{label}</span>
          </ProgressLink>
        );
      })}
    </nav>
  );
}
