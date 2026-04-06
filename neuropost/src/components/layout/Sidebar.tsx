'use client';

import { usePathname, useRouter } from 'next/navigation';
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'CONTENIDO',
    items: [
      { href: '/dashboard', label: 'Inicio',      icon: LayoutDashboard },
      { href: '/posts',     label: 'Posts',        icon: Image },
      { href: '/calendar',  label: 'Calendario',   icon: Calendar },
      { href: '/ideas',     label: 'Ideas',         icon: Lightbulb },
      { href: '/mi-feed',     label: 'Mi feed',       icon: Grid3x3 },
      { href: '/inspiracion', label: 'Inspiración',   icon: Flame },
    ],
  },
  {
    title: 'GESTIÓN',
    items: [
      { href: '/comments',  label: 'Comentarios',  icon: MessageSquare },
      { href: '/analytics', label: 'Analíticas',   icon: BarChart3 },
      { href: '/historial', label: 'Historial',    icon: Archive },
      { href: '/novedades', label: 'Novedades',    icon: Sparkles },
    ],
  },
  {
    title: 'EQUIPO NEUROPOST',
    items: [
      { href: '/chat',        label: 'Chat',         icon: MessageCircle },
      { href: '/solicitudes', label: 'Solicitudes',  icon: ClipboardList },
      { href: '/soporte',     label: 'Soporte',      icon: LifeBuoy },
    ],
  },
  {
    title: 'MARCA',
    items: [
      { href: '/brand',    label: 'Brand Kit', icon: Palette },
      { href: '/settings', label: 'Ajustes',   icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname      = usePathname();
  const router        = useRouter();
  const brand         = useAppStore((s) => s.brand);
  const sidebarOpen   = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadComments      = useAppStore((s) => s.unreadComments);
  const unreadNotifications = useAppStore((s) => s.unreadNotifications);

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-header">
        <ProgressLink href="/dashboard" className="dash-logo">NeuroPost</ProgressLink>
        <button className="sidebar-close-btn" onClick={toggleSidebar} aria-label="Cerrar menú">
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
          Estado del servicio
        </a>
        <ProgressLink href="/novedades"
          style={{ display: 'block', fontSize: '0.68rem', color: '#3a4257', textDecoration: 'none', padding: '2px 0', lineHeight: 1.4 }}
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}>
          Novedades
        </ProgressLink>
        <ProgressLink href="/soporte"
          style={{ display: 'block', fontSize: '0.68rem', color: '#3a4257', textDecoration: 'none', padding: '2px 0', lineHeight: 1.4 }}
          onClick={() => { if (sidebarOpen) toggleSidebar(); }}>
          Soporte
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
          <span>Salir</span>
        </button>
      </div>
    </aside>
  );
}
