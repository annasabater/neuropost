'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProgressLink } from '@/components/ui/ProgressLink';
import {
  LayoutDashboard, Calendar, MessageSquare, BarChart3,
  Settings, LogOut, X, Image, Archive,
  Flame, Plus, Upload, ChevronDown, Link2, CreditCard, Palette,
  Sparkles, Send, Paintbrush, Camera,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';
import { PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const brand = useAppStore((s) => s.brand);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadComments = useAppStore((s) => s.unreadComments);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const nav = (href: string) => { if (sidebarOpen) toggleSidebar(); setProfileOpen(false); };

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }) {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return (
      <ProgressLink href={href} className={`dash-nav-item${active ? ' active' : ''}`} onClick={() => nav(href)}>
        <Icon size={15} />
        <span>{label}</span>
        {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
      </ProgressLink>
    );
  }

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <aside className="dash-sidebar">
      {/* ── Header ── */}
      <div className="dash-sidebar-header">
        <ProgressLink href="/dashboard" className="dash-logo">NeuroPost</ProgressLink>
        <button className="sidebar-close-btn" onClick={toggleSidebar} aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      {/* ── Create button — direct link ── */}
      <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
        <ProgressLink
          href="/posts/new"
          onClick={() => nav('/posts/new')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', background: '#111827', color: '#ffffff', border: 'none',
            fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer', width: '100%',
            transition: 'background 0.15s', textDecoration: 'none', boxSizing: 'border-box',
          }}
        >
          <Plus size={15} /> Crear
        </ProgressLink>
      </div>

      {/* ── Navigation ── */}
      <div className="dash-nav">
        {/* Inicio */}
        <NavItem href="/dashboard" label={t('dashboard')} icon={LayoutDashboard} />

        {/* Contenido */}
        <div className="dash-nav-group-label">Contenido</div>
        <NavItem href="/posts" label={t('posts')} icon={Image} />
        <NavItem href="/inspiracion" label={t('inspiration')} icon={Flame} />
        <NavItem href="/calendar" label={t('calendar')} icon={Calendar} />

        {/* Biblioteca */}
        <div className="dash-nav-group-label">Biblioteca</div>
        <NavItem href="/biblioteca" label="Contenido" icon={Upload} />
        <NavItem href="/feed" label="Feed" icon={Camera} />

        {/* Rendimiento */}
        <div className="dash-nav-group-label">Rendimiento</div>
        <NavItem href="/analytics" label={t('analytics')} icon={BarChart3} />

        {/* Otros */}
        <div className="dash-nav-group-label">Otros</div>
        <NavItem href="/historial" label={t('history')} icon={Archive} />
        <NavItem href="/inbox" label="Inbox" icon={MessageSquare} badge={unreadComments} />
        <NavItem href="/billing" label="Facturación" icon={CreditCard} />
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
            {brand?.name?.charAt(0).toUpperCase() ?? 'N'}
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <p style={{ fontFamily: f, fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {brand?.name ?? 'Mi negocio'}
            </p>
            <p style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {PLAN_META[(brand?.plan ?? 'starter') as SubscriptionPlan]?.label ?? 'Esencial'}
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
            {[
              { href: '/brand', label: 'Brand Kit', icon: Palette },
              { href: '/settings', label: 'Ajustes', icon: Settings },
            ].map(({ href, label, icon: Icon }) => (
              <ProgressLink key={href} href={href} onClick={() => nav(href)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                textDecoration: 'none', color: '#374151', fontFamily: f, fontSize: 13,
                fontWeight: 500, transition: 'background 0.1s', borderBottom: '1px solid #f3f4f6',
              }}>
                <Icon size={14} style={{ color: '#9ca3af' }} />
                {label}
              </ProgressLink>
            ))}
            <button onClick={handleLogout} style={{
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
