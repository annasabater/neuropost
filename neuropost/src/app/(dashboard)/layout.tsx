'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { AppLoader } from '@/components/ui/AppLoader';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { DashboardTutorial } from '@/components/ui/DashboardTutorial';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';
import { locales } from '@/i18n/config';

/** Runs once per browser session to apply the user's saved theme & locale. */
function PreferencesSync() {
  const router = useRouter();
  useEffect(() => {
    // Only run once per session to avoid repeated refreshes
    if (sessionStorage.getItem('prefs-synced')) return;
    sessionStorage.setItem('prefs-synced', '1');

    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata ?? {};

        // Sync locale: if user has a saved locale that differs from current cookie, apply it
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
    <div className={`dash-root${sidebarOpen ? ' sidebar-open' : ' sidebar-collapsed'}`}>
      <PreferencesSync />
      {/* Initial page-load animation — fades out after 1.2s */}
      <AppLoader />

      <Sidebar />

      <div className="dash-content">
        <TopNav />
        <main className="dash-main">{children}</main>
      </div>

      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={toggleSidebar} />

      <FeedbackWidget />
      <DashboardTutorial />
    </div>
  );
}
