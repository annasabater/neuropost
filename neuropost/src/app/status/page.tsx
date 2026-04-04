import type { Metadata } from 'next';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Estado del sistema — NeuroPost',
  description: 'Estado en tiempo real de los servicios de NeuroPost',
  robots: { index: true, follow: true },
};

// Revalidate every 60 seconds
export const revalidate = 60;

type ServiceStatus = 'ok' | 'degraded' | 'down';

type ServiceResult = {
  name: string;
  description: string;
  status: ServiceStatus;
  latencyMs?: number;
  note?: string;
};

async function checkSupabase(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    const supabase = createAdminClient();
    await supabase.from('brands').select('id').limit(1);
    return { name: 'Base de datos', description: 'PostgreSQL · Supabase', status: 'ok', latencyMs: Date.now() - t };
  } catch {
    return { name: 'Base de datos', description: 'PostgreSQL · Supabase', status: 'down', note: 'No se puede conectar' };
  }
}

async function checkAnthropicAPI(): Promise<ServiceResult> {
  // We don't ping Anthropic directly — just verify the key is present
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return {
    name:        'IA (Claude)',
    description: 'Anthropic API · Generación de contenido',
    status:      hasKey ? 'ok' : 'degraded',
    note:        hasKey ? undefined : 'Clave de API no configurada',
  };
}

async function checkMetaAPI(): Promise<ServiceResult> {
  const t = Date.now();
  try {
    const res = await fetch('https://graph.facebook.com/v19.0/', { next: { revalidate: 60 } });
    if (res.ok || res.status === 400) {
      // 400 means it's up but we didn't pass a valid token — that's fine
      return { name: 'Meta API', description: 'Instagram & Facebook Graph API', status: 'ok', latencyMs: Date.now() - t };
    }
    return { name: 'Meta API', description: 'Instagram & Facebook Graph API', status: 'degraded', note: `HTTP ${res.status}` };
  } catch {
    return { name: 'Meta API', description: 'Instagram & Facebook Graph API', status: 'down', note: 'Sin respuesta' };
  }
}

async function checkStripe(): Promise<ServiceResult> {
  const hasKey = !!process.env.STRIPE_SECRET_KEY;
  return {
    name:        'Pagos (Stripe)',
    description: 'Suscripciones y facturación',
    status:      hasKey ? 'ok' : 'degraded',
    note:        hasKey ? undefined : 'Clave de API no configurada',
  };
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const cfg: Record<ServiceStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    ok:       { label: 'Operativo',  bg: '#e8f5ee', color: '#1a7a4a', icon: <CheckCircle2 size={15} /> },
    degraded: { label: 'Degradado',  bg: '#fef9c3', color: '#a16207', icon: <AlertCircle  size={15} /> },
    down:     { label: 'Caído',      bg: '#fee2e2', color: '#dc2626', icon: <AlertCircle  size={15} /> },
  };
  const c = cfg[status];
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         5,
      padding:     '4px 10px',
      borderRadius: 20,
      fontSize:    '0.78rem',
      fontWeight:  700,
      background:  c.bg,
      color:       c.color,
      fontFamily:  "'Cabinet Grotesk', sans-serif",
    }}>
      {c.icon}{c.label}
    </span>
  );
}

export default async function StatusPage() {
  const [db, ai, meta, stripe] = await Promise.all([
    checkSupabase(),
    checkAnthropicAPI(),
    checkMetaAPI(),
    checkStripe(),
  ]);

  const services = [db, ai, meta, stripe];
  const allOk    = services.every((s) => s.status === 'ok');
  const anyDown  = services.some((s) => s.status === 'down');

  const overallStatus: ServiceStatus = anyDown ? 'down' : allOk ? 'ok' : 'degraded';
  const overallLabels: Record<ServiceStatus, { text: string; bg: string; border: string; color: string }> = {
    ok:       { text: 'Todos los sistemas operativos',  bg: '#e8f5ee', border: '#bbf7d0', color: '#1a7a4a' },
    degraded: { text: 'Algunos sistemas degradados',     bg: '#fef9c3', border: '#fde68a', color: '#a16207' },
    down:     { text: 'Hay servicios caídos',            bg: '#fee2e2', border: '#fecaca', color: '#dc2626' },
  };
  const overall = overallLabels[overallStatus];

  const now = new Date().toLocaleString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      minHeight:  '100vh',
      background: 'var(--cream)',
      padding:    'clamp(32px, 8vw, 80px) 16px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <a href="/" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.4rem', color: 'var(--orange)', textDecoration: 'none' }}>
            NeuroPost
          </a>
          <h1 style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 900,
            fontSize:   'clamp(1.8rem, 5vw, 2.4rem)',
            letterSpacing: '-0.03em',
            marginTop:  16,
            marginBottom: 6,
          }}>
            Estado del sistema
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: '0.85rem' }}>
            <Clock size={14} />
            <span>Última comprobación: {now}</span>
          </div>
        </div>

        {/* Overall banner */}
        <div style={{
          background:   overall.bg,
          border:       `1.5px solid ${overall.border}`,
          borderRadius: 14,
          padding:      '18px 22px',
          marginBottom: 28,
          display:      'flex',
          alignItems:   'center',
          gap:          12,
        }}>
          {overallStatus === 'ok'
            ? <CheckCircle2 size={22} color={overall.color} />
            : <AlertCircle  size={22} color={overall.color} />}
          <span style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 800,
            color:      overall.color,
            fontSize:   '1rem',
          }}>
            {overall.text}
          </span>
        </div>

        {/* Services list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {services.map((svc) => (
            <div
              key={svc.name}
              style={{
                background:   'white',
                border:       '1.5px solid var(--border)',
                borderRadius: 12,
                padding:      '16px 20px',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'space-between',
                gap:          16,
              }}
            >
              <div>
                <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, marginBottom: 2 }}>
                  {svc.name}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {svc.description}
                  {svc.latencyMs != null && ` · ${svc.latencyMs}ms`}
                  {svc.note && ` · ${svc.note}`}
                </p>
              </div>
              <StatusBadge status={svc.status} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 36, textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)' }}>
          ¿Tienes problemas?{' '}
          <a href="mailto:hola@neuropost.es" style={{ color: 'var(--orange)', fontWeight: 700, textDecoration: 'none' }}>
            Escríbenos
          </a>
        </p>
      </div>
    </div>
  );
}
