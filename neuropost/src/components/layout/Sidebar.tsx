'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ProgressLink } from '@/components/ui/ProgressLink';
import {
  LayoutDashboard,
  Lightbulb,
  Calendar,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  X,
  Image,
  Palette,
  Bell,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';

const NAV = [
  { href: '/dashboard',     label: 'Inicio',         icon: LayoutDashboard },
  { href: '/posts',         label: 'Posts',           icon: Image },
  { href: '/ideas',         label: 'Ideas',           icon: Lightbulb },
  { href: '/calendar',      label: 'Calendario',      icon: Calendar },
  { href: '/resumen',       label: 'Resumen',          icon: CalendarDays },
  { href: '/tendencias',    label: 'Tendencias',      icon: TrendingUp },
  { href: '/competencia',   label: 'Competencia',     icon: Users },
  { href: '/comments',      label: 'Comunidad',       icon: MessageSquare },
  { href: '/analytics',     label: 'Analíticas',      icon: BarChart3 },
  { href: '/brand',         label: 'Brand Kit',       icon: Palette },
  { href: '/notifications', label: 'Notificaciones',  icon: Bell },
  { href: '/settings',      label: 'Ajustes',         icon: Settings },
];

export function Sidebar() {
  const pathname      = usePathname();
  const router        = useRouter();
  const brand         = useAppStore((s) => s.brand);
  const sidebarOpen   = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const unreadComments     = useAppStore((s) => s.unreadComments);
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

      <nav className="dash-nav">
        {NAV.map(({ href, label, icon: Icon }) => {
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
      </nav>

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
