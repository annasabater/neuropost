'use client';

import { useAppStore } from '@/store/useAppStore';
import { Sidebar, BottomNav } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { AppLoader } from '@/components/ui/AppLoader';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { DashboardTutorial } from '@/components/ui/DashboardTutorial';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { locales } from '@/i18n/config';

/** Runs once per browser session to apply the user's saved theme & locale. */
function PreferencesSync() {
  const router = useRouter();
  useEffect(() => {
    if (sessionStorage.getItem('prefs-synced')) return;
    sessionStorage.setItem('prefs-synced', '1');
    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata ?? {};
        if (meta.locale && (locales as readonly string[]).includes(meta.locale as string)) {
          const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
          const cookieLocale = match?.[1];
          if (cookieLocale !== meta.locale) {
            document.cookie = `NEXT_LOCALE=${meta.locale}; path=/; max-age=31536000; SameSite=Lax`;
            router.refresh();
          }
        }
      } catch { /* non-blocking */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen   = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <div className={`ig-root${sidebarOpen ? ' sidebar-open' : ''}`}>
      <PreferencesSync />
      <AppLoader />

      {/* Sidebar — hidden on mobile, visible on desktop */}
      <Sidebar />

      {/* Overlay — mobile only, closes sidebar */}
      <div className="ig-overlay" onClick={toggleSidebar} />

      {/* Main area */}
      <div className="ig-main">
        <TopNav />
        <main className="ig-content">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />

      <FeedbackWidget />
      <DashboardTutorial />
    </div>
  );
}
