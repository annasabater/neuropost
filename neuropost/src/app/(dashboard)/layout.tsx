'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { AppLoader } from '@/components/ui/AppLoader';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { DashboardTutorial } from '@/components/ui/DashboardTutorial';
import { useAppStore } from '@/store/useAppStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen   = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <div className={`dash-root${sidebarOpen ? ' sidebar-open' : ''}`}>
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
