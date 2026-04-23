'use client';

import { usePathname } from 'next/navigation';
import { PlanSidebar } from './_components/PlanSidebar';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function PlanificacionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetail = pathname !== '/planificacion';

  if (!isDetail) return <>{children}</>;

  return (
    <>
      <style>{`
        .plan-layout-root { display: flex; flex-direction: column; min-height: 100vh; }
        .plan-layout-header { display: flex; background: #f5f5f5; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
        .plan-layout-header-left { width: 272px; flex-shrink: 0; border-right: 1px solid #e5e7eb; padding: 28px 16px 20px; }
        .plan-layout-body { display: flex; flex: 1; align-items: stretch; }
        .plan-layout-aside { width: 272px; flex-shrink: 0; border-right: 1px solid #e5e7eb; overflow-y: auto; background: #ffffff; }
        .plan-layout-content { flex: 1; min-width: 0; }
        .plan-sticky-footer { position: fixed; bottom: 0; left: 272px; right: 0; background: var(--bg); border-top: 2px solid var(--border); padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; z-index: 10; }
        @media (max-width: 767px) {
          .plan-layout-header-left { display: none; }
          .plan-layout-aside { display: none; }
          .plan-layout-content { width: 100%; }
          .plan-sticky-footer { left: 0 !important; padding: 12px 16px; flex-direction: column; gap: 10px; align-items: stretch; }
          .plan-sticky-footer > div { flex-direction: column; gap: 8px; align-items: stretch; width: 100%; }
          .plan-confirm-btn { width: 100% !important; justify-content: center; font-size: 15px !important; padding: 14px !important; }
          .plan-skip-link { text-align: center; }
          .plan-idea-card { grid-template-columns: 48px 1fr !important; }
          .plan-idea-number { font-size: 22px !important; padding-top: 14px !important; }
          .plan-idea-content { padding: 14px 12px 12px !important; }
          .plan-idea-actions { flex-wrap: wrap !important; gap: 6px !important; }
          .plan-idea-actions-secondary { flex-wrap: wrap !important; }
          .plan-idea-status-badge { font-size: 9px !important; }
          .plan-progress-badge { margin-top: 8px !important; }
          .plan-header-row { flex-direction: column !important; align-items: flex-start !important; }
          .plan-header-inner { padding: 16px 16px 12px !important; }
        }
      `}</style>
      <div className="plan-layout-root">

        {/* ── Full-width gray header ── */}
        <div className="plan-layout-header">
          <div className="plan-layout-header-left">
            <p style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--accent)', margin: '0 0 6px',
            }}>
              Tu contenido semanal
            </p>
            <h2 style={{
              fontFamily: fc, fontWeight: 900, fontSize: '1.5rem',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: 'var(--text-primary)', lineHeight: 0.92, margin: 0,
            }}>
              Planificación
            </h2>
          </div>
          <div style={{ flex: 1 }} />
        </div>

        {/* ── Below header: sidebar | detail ── */}
        <div className="plan-layout-body">
          <aside className="plan-layout-aside">
            <PlanSidebar />
          </aside>
          <div className="plan-layout-content">
            {children}
          </div>
        </div>

      </div>
    </>
  );
}
