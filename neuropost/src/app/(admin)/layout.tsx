'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, MessageSquare, Mail, Inbox,
  BarChart2, ChevronRight, LogOut, TrendingDown, AtSign, Tag,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

const NAV = [
  { href: '/captacion',                       icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/captacion/prospects',              icon: Users,           label: 'Prospects' },
  { href: '/captacion/comentarios/respuestas', icon: MessageSquare,   label: 'Comentarios' },
  { href: '/captacion/mensajes',               icon: Inbox,           label: 'Mensajes DM' },
  { href: '/captacion/email/respuestas',       icon: Mail,            label: 'Email' },
  { href: '/captacion/ads',                    icon: BarChart2,       label: 'Meta Ads' },
  { href: '/churn',                            icon: TrendingDown,    label: 'Retención' },
  { href: '/contactos',                        icon: AtSign,          label: 'Contactos' },
  { href: '/cupones',                          icon: Tag,             label: 'Cupones' },
];

const A = {
  bg:     '#0f0e0c',
  card:   '#1a1917',
  border: '#2a2927',
  orange: '#ff6b35',
  muted:  '#666',
  text:   '#e8e3db',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checking, setChecking] = useState(true);
  const [badge, setBadge]       = useState<number>(0);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // Verify superadmin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'superadmin') { router.replace('/dashboard'); return; }

      setChecking(false);

      // Live unread messages badge
      const channel = supabase
        .channel('admin-messages')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'messages',
          filter: 'status=eq.unread',
        }, () => {
          supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('status', 'unread')
            .then(({ count }) => setBadge(count ?? 0));
        })
        .subscribe();

      supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('status', 'unread')
        .then(({ count }) => setBadge(count ?? 0));

      return () => { supabase.removeChannel(channel); };
    })();
  }, [router]);

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (checking) {
    return (
      <div style={{ background: A.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: A.muted, fontSize: 14 }}>Verificando acceso...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: A.bg, color: A.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: A.card,
        borderRight: `1px solid ${A.border}`,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 8px', borderBottom: `1px solid ${A.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: A.orange, letterSpacing: -0.5 }}>NeuroPost</span>
          <span style={{ marginLeft: 8, fontSize: 10, color: A.muted, background: '#2a2927', padding: '2px 6px', borderRadius: 4, verticalAlign: 'middle' }}>
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/captacion' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            10,
                  padding:        '9px 12px',
                  borderRadius:   8,
                  marginBottom:   2,
                  fontSize:       13,
                  fontWeight:     active ? 700 : 400,
                  color:          active ? A.orange : A.text,
                  background:     active ? 'rgba(255,107,53,0.12)' : 'transparent',
                  textDecoration: 'none',
                  position:       'relative',
                }}
              >
                <Icon size={15} />
                {label}
                {label === 'Mensajes DM' && badge > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: A.orange, color: '#fff',
                    borderRadius: 10, fontSize: 10, fontWeight: 800,
                    padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  }}>
                    {badge}
                  </span>
                )}
                {active && <ChevronRight size={12} style={{ marginLeft: 'auto', color: A.orange }} />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            margin: 10, padding: '9px 12px', borderRadius: 8,
            background: 'none', border: `1px solid ${A.border}`,
            color: A.muted, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
