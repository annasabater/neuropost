'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, MessageSquare, Users, Activity,
  BarChart3, Clock, Settings, LogOut, ChevronRight, Tag, LifeBuoy,
  Radio, CheckSquare, Ticket, Bot, TrendingUp,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import type { Worker } from '@/types';

const W = {
  bg:     '#0a0a14',
  card:   '#111827',
  border: '#1e2533',
  blue:   '#3b82f6',
  text:   '#e5e7eb',
  muted:  '#6b7280',
};

const NAV_GROUPS = [
  {
    label: 'PRINCIPAL',
    items: [
      { href: '/worker/dashboard',  icon: LayoutDashboard, label: 'Panel principal' },
      { href: '/worker/feed',       icon: Radio,           label: 'Feed de agentes' },
      { href: '/worker/validation', icon: CheckSquare,     label: 'Validación' },
      { href: '/worker/cola',       icon: ClipboardList,   label: 'Cola de trabajo', badge: 'queue' },
    ],
  },
  {
    label: 'COMUNICACIÓN',
    items: [
      { href: '/worker/mensajes', icon: MessageSquare, label: 'Mensajes', badge: 'msg' },
      { href: '/worker/tickets',  icon: Ticket,        label: 'Tickets' },
      { href: '/worker/soporte',  icon: LifeBuoy,      label: 'Soporte' },
    ],
  },
  {
    label: 'CLIENTES',
    items: [
      { href: '/worker/clientes',  icon: Users,    label: 'Todos los clientes' },
      { href: '/worker/actividad', icon: Activity, label: 'Actividad reciente' },
    ],
  },
  {
    label: 'MÉTRICAS',
    items: [
      { href: '/worker/metricas',       icon: BarChart3, label: 'Métricas del equipo' },
      { href: '/worker/mi-rendimiento', icon: Clock,     label: 'Mi rendimiento' },
    ],
  },
];

const ADMIN_NAV = {
  label: 'ADMINISTRACIÓN',
  items: [
    { href: '/worker/agents',             icon: Bot,        label: 'Monitor de agentes' },
    { href: '/worker/business',           icon: TrendingUp, label: 'Métricas de negocio' },
    { href: '/worker/admin/trabajadores', icon: Settings,   label: 'Gestión de trabajadores' },
    { href: '/worker/settings',           icon: Settings,   label: 'Configuración' },
    { href: '/cupones',                    icon: Tag,       label: 'Gestión de cupones' },
  ],
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [worker, setWorker]   = useState<Worker | null>(null);
  const [checking, setChecking] = useState(true);
  const [queueBadge, setQueueBadge] = useState(0);
  const [msgBadge, setMsgBadge]     = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const res = await fetch('/api/worker/me');
      if (!res.ok) { router.replace('/dashboard'); return; }
      const json = await res.json();
      setWorker(json.worker);
      setChecking(false);

      // Live queue badge
      supabase
        .channel('worker-queue')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'content_queue', filter: 'status=eq.pending_worker' }, () => {
          fetch('/api/worker/cola?status=pending_worker').then((r) => r.json()).then((d) => setQueueBadge(d.queue?.length ?? 0));
        })
        .subscribe();

      fetch('/api/worker/cola?status=pending_worker').then((r) => r.json()).then((d) => setQueueBadge(d.queue?.length ?? 0));
      fetch('/api/worker/mensajes').then((r) => r.json()).then((d) => setMsgBadge((d.messages ?? []).filter((m: { read: boolean }) => !m.read).length));
    })();
  }, [router]);

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (checking) {
    return (
      <div style={{ background: W.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: W.muted, fontSize: 14 }}>Verificando acceso...</div>
      </div>
    );
  }

  const allGroups = worker?.role === 'admin' || worker?.role === 'senior'
    ? [...NAV_GROUPS, ADMIN_NAV]
    : NAV_GROUPS;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: W.bg, color: W.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 230, flexShrink: 0, background: W.card,
        borderRight: `1px solid ${W.border}`,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${W.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: W.blue, letterSpacing: -0.5 }}>NeuroPost</div>
          <div style={{ fontSize: 10, color: W.muted, marginTop: 2 }}>Equipo Interno</div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {allGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: 1, padding: '0 10px 6px' }}>
                {group.label}
              </div>
              {group.items.map((navItem) => {
                const { href, icon: Icon, label } = navItem;
                const badge = (navItem as { badge?: string }).badge;
                const active = pathname === href || (href !== '/worker/dashboard' && pathname.startsWith(href));
                const badgeCount = badge === 'queue' ? queueBadge : badge === 'msg' ? msgBadge : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                      fontSize: 13, fontWeight: active ? 700 : 400,
                      color: active ? W.blue : W.text,
                      background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={15} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badgeCount > 0 && (
                      <span style={{
                        background: badge === 'queue' ? '#ef4444' : W.blue,
                        color: '#fff', borderRadius: 10, fontSize: 10,
                        fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                      }}>
                        {badgeCount}
                      </span>
                    )}
                    {active && <ChevronRight size={12} style={{ color: W.blue }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Worker info + logout */}
        <div style={{ padding: 12, borderTop: `1px solid ${W.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: W.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {worker?.full_name?.charAt(0)?.toUpperCase() ?? 'W'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{worker?.full_name ?? 'Worker'}</div>
              <div style={{ fontSize: 10, color: W.muted, textTransform: 'capitalize' }}>{worker?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'none', border: `1px solid ${W.border}`,
            color: W.muted, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
