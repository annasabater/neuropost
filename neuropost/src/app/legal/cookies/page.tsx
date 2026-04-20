import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de cookies — NeuroPost',
};

/* ─── Shared legal style tokens ─────────────────────────────────────────────── */
const s = {
  page: {
    padding: '64px 0 90px',
    background: '#ffffff',
    minHeight: '100vh',
  } as React.CSSProperties,
  breadcrumb: {
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--muted)',
    marginBottom: '36px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  breadcrumbLink: {
    color: 'var(--orange)',
    textDecoration: 'none',
    fontWeight: 600,
  } as React.CSSProperties,
  hero: {
    marginBottom: '52px',
    paddingBottom: '32px',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  heroTitle: {
    fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 'clamp(2.1rem, 4.4vw, 3.1rem)',
    color: 'var(--ink)',
    textTransform: 'uppercase',
    letterSpacing: '-0.01em',
    lineHeight: 0.95,
    marginBottom: '14px',
  } as React.CSSProperties,
  heroMeta: {
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '14px',
    color: 'var(--muted)',
    lineHeight: 1.7,
  } as React.CSSProperties,
  section: {
    marginBottom: '40px',
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: '1.6rem',
    color: 'var(--ink)',
    marginBottom: '12px',
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  paragraph: {
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '15px',
    color: 'var(--ink)',
    lineHeight: '1.75',
    marginBottom: '12px',
  } as React.CSSProperties,
  list: {
    paddingLeft: '20px',
    marginBottom: '12px',
  } as React.CSSProperties,
  listItem: {
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '15px',
    color: 'var(--ink)',
    lineHeight: '1.75',
    marginBottom: '4px',
  } as React.CSSProperties,
  divider: {
    borderBottom: '1px solid var(--border)',
    marginBottom: '48px',
  } as React.CSSProperties,
};

const tableStyles = {
  wrapper: {
    overflowX: 'auto' as const,
    marginBottom: '12px',
    borderRadius: '0px',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '14px',
  } as React.CSSProperties,
  th: {
    background: '#f5f5f5',
    color: 'var(--ink)',
    fontWeight: 700,
    padding: '12px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '12px 16px',
    color: 'var(--ink)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  tdLast: {
    padding: '12px 16px',
    color: 'var(--ink)',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  trEven: {
    background: '#ffffff',
  } as React.CSSProperties,
  trOdd: {
    background: '#fafafa',
  } as React.CSSProperties,
};

const COOKIES = [
  { name: 'supabase-auth-token', purpose: 'Sesión autenticada', duration: 'Sesión', type: 'Necesaria' },
  { name: 'NEXT_LOCALE', purpose: 'Preferencia de idioma', duration: '1 año', type: 'Funcional' },
  { name: 'data-theme', purpose: 'Preferencia de tema (claro/oscuro)', duration: 'Local', type: 'Funcional' },
  { name: 'ph_*', purpose: 'Analíticas de producto (PostHog)', duration: '1 año', type: 'Analítica' },
  { name: 'stripe_sid', purpose: 'Procesar pagos de forma segura', duration: 'Sesión', type: 'Necesaria' },
];

export default function CookiesPage() {
  return (
    <div style={s.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <Link href="/" style={s.breadcrumbLink}>← Volver al inicio</Link>
          <span>·</span>
          <span>Política de cookies</span>
        </div>

        {/* Hero */}
        <div style={s.hero}>
          <h1 style={s.heroTitle}>Política de cookies</h1>
          <p style={s.heroMeta}>Última actualización: 1 de abril de 2025</p>
        </div>

        {/* Qué son las cookies */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. Qué son las cookies</h2>
          <p style={s.paragraph}>
            Las cookies son pequeños archivos de texto que los sitios web almacenan en tu navegador cuando los visitas.
            Se utilizan para recordar información sobre tu sesión, preferencias y comportamiento de uso, lo que permite
            ofrecer una experiencia más personalizada y fluida.
          </p>
          <p style={s.paragraph}>
            Existen distintos tipos de cookies según su finalidad: necesarias para el funcionamiento del servicio,
            funcionales para recordar preferencias, y analíticas para entender cómo se usa la plataforma.
          </p>
        </div>
        <div style={s.divider} />

        {/* Cookies que usamos */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. Cookies que usamos</h2>
          <p style={s.paragraph}>
            A continuación se detallan todas las cookies que puede instalar NeuroPost en tu navegador:
          </p>
          <div style={tableStyles.wrapper}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Nombre</th>
                  <th style={tableStyles.th}>Finalidad</th>
                  <th style={tableStyles.th}>Duración</th>
                  <th style={tableStyles.th}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((row, i) => (
                  <tr key={row.name} style={i % 2 === 0 ? tableStyles.trEven : tableStyles.trOdd}>
                    <td style={tableStyles.td}>
                      <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'var(--warm)', padding: '2px 6px', borderRadius: '4px' }}>
                        {row.name}
                      </code>
                    </td>
                    <td style={tableStyles.td}>{row.purpose}</td>
                    <td style={tableStyles.td}>{row.duration}</td>
                    <td style={i === COOKIES.length - 1 ? tableStyles.tdLast : tableStyles.td}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '0px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: row.type === 'Necesaria' ? 'var(--green-light)' : row.type === 'Analítica' ? '#fff0eb' : 'var(--warm)',
                        color: row.type === 'Necesaria' ? 'var(--green)' : row.type === 'Analítica' ? 'var(--orange)' : 'var(--muted)',
                      }}>
                        {row.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={s.divider} />

        {/* Cómo desactivarlas */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Cómo desactivar las cookies</h2>
          <p style={s.paragraph}>
            Puedes controlar y gestionar las cookies de varias formas:
          </p>
          <ul style={s.list}>
            <li style={s.listItem}>
              <strong>Panel de preferencias de NeuroPost:</strong> al acceder por primera vez, o desde el enlace &quot;Gestionar cookies&quot; en el pie de página, puedes elegir qué categorías de cookies aceptas.
            </li>
            <li style={s.listItem}>
              <strong>Configuración del navegador:</strong> la mayoría de navegadores te permiten bloquear o eliminar cookies desde sus ajustes de privacidad. Ten en cuenta que bloquear las cookies necesarias puede afectar al funcionamiento del servicio.
            </li>
            <li style={s.listItem}>
              <strong>Herramientas específicas:</strong> para las cookies analíticas de PostHog, puedes desactivar el seguimiento directamente desde las preferencias de tu cuenta.
            </li>
          </ul>
          <p style={s.paragraph}>
            Para más información sobre cómo gestionar cookies en tu navegador, consulta la ayuda de Chrome, Firefox, Safari o Edge según corresponda.
          </p>
        </div>
      </div>
    </div>
  );
}
