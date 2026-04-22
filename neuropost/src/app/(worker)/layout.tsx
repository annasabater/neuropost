'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WorkerSidebar }  from '@/components/worker/WorkerSidebar';
import { WorkerTopNav }   from '@/components/worker/WorkerTopNav';
import { WorkerTopTabs }  from '@/components/worker/WorkerTopTabs';
import { W } from '@/components/worker/theme';
import { createBrowserClient } from '@/lib/supabase';
import type { Worker } from '@/types';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [worker, setWorker]   = useState<Worker | null>(null);
  const [checking, setChecking] = useState(true);
  const [queueBadge, setQueueBadge] = useState(0);
  const [validationBadge, setValidationBadge] = useState(0);
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

    const refreshValidationBadge = async () => {
      try {
        const res  = await fetch('/api/worker/validation-pending-counts');
        const data = await res.json();
        if (!cancelled) setValidationBadge(data.total ?? 0);
      } catch {
        if (!cancelled) setValidationBadge(0);
      }
    };

    const channel = supabase
      .channel('worker-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_queue', filter: 'status=eq.pending_worker' }, () => {
        void refreshQueueBadge();
      })
      .subscribe();

    const validationInterval = setInterval(() => { void refreshValidationBadge(); }, 60_000);

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
        await Promise.all([refreshQueueBadge(), refreshValidationBadge()]);
      } catch {
        router.replace('/dashboard');
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(validationInterval);
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
    <div className={`dash-root worker-root${sidebarOpen ? ' sidebar-open' : ''}`}>
      <WorkerSidebar
        pathname={pathname}
        worker={worker}
        queueBadge={queueBadge}
        msgBadge={0}
        validationBadge={validationBadge}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="dash-content">
        <WorkerTopNav
          pathname={pathname}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
        />
        <WorkerTopTabs />
        <main className="dash-main">{children}</main>
      </div>

      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
    </div>
  );
}
