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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Full-width gray header — single row, guaranteed same height on both sides ── */}
      <div style={{ display: 'flex', background: '#f5f5f5', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {/* Left column: title */}
        <div style={{ width: 272, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: '28px 16px 20px' }}>
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
        {/* Right column: just gray — children supply their own content below */}
        <div style={{ flex: 1 }} />
      </div>

      {/* ── Below gray header: plan list | detail content ── */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
        <aside style={{
          width: 272,
          flexShrink: 0,
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          background: '#ffffff',
        }}>
          <PlanSidebar />
        </aside>
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>

    </div>
  );
}
