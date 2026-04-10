'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WorkerSidebar } from '@/components/worker/WorkerSidebar';
import { WorkerTopNav } from '@/components/worker/WorkerTopNav';
import { W } from '@/components/worker/theme';
import { createBrowserClient } from '@/lib/supabase';
import type { Worker } from '@/types';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [worker, setWorker]   = useState<Worker | null>(null);
  const [checking, setChecking] = useState(true);
  const [queueBadge, setQueueBadge] = useState(0);
  const [msgBadge, setMsgBadge]     = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;
    const refreshQueueBadge = async () => {
      try {
        const response = await fetch('/api/worker/cola?status=pending_worker');
        const data = await response.json();
        if (!cancelled) setQueueBadge(data.queue?.length ?? 0);
      } catch {
        if (!cancelled) setQueueBadge(0);
      }
    };
    const refreshMsgBadge = async () => {
      try {
        const response = await fetch('/api/worker/mensajes');
        const data = await response.json();
        if (!cancelled) {
          setMsgBadge((data.messages ?? []).filter((message: { read: boolean }) => !message.read).length);
        }
      } catch {
        if (!cancelled) setMsgBadge(0);
      }
    };

    const channel = supabase
      .channel('worker-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_queue', filter: 'status=eq.pending_worker' }, () => {
        void refreshQueueBadge();
      })
      .subscribe();

    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const res = await fetch('/api/worker/me');
        if (!res.ok) {
          router.replace('/dashboard');
          return;
        }

        const json = await res.json();
        if (cancelled) return;

        setWorker(json.worker);
        setChecking(false);
        await Promise.all([refreshQueueBadge(), refreshMsgBadge()]);
      } catch {
        router.replace('/dashboard');
      }
    })();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleLogout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (checking) {
    return (
      <div className="dash-root worker-root" style={{ minHeight: '100vh' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: W.muted, fontSize: 14 }}>Verificando acceso...</div>
        </div>
      </div>
    );
  }

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

      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
    </div>
  );
}
