import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso legal — NeuroPost',
};

/* ─── Shared legal style tokens ─────────────────────────────────────────────── */
const s = {
  page: {
    padding: '60px 0 80px',
    background: 'var(--cream)',
    minHeight: '100vh',
  } as React.CSSProperties,
  breadcrumb: {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: '0.85rem',
    color: 'var(--muted)',
    marginBottom: '40px',
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
    marginBottom: '56px',
    paddingBottom: '40px',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  heroTitle: {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontWeight: 900,
    fontSize: 'clamp(2rem, 4vw, 2.8rem)',
    color: 'var(--ink)',
    letterSpacing: '-0.04em',
    lineHeight: 1.1,
    marginBottom: '16px',
  } as React.CSSProperties,
  heroMeta: {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: '0.88rem',
    color: 'var(--muted)',
  } as React.CSSProperties,
  section: {
    marginBottom: '48px',
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontWeight: 800,
    fontSize: '1.2rem',
    color: 'var(--ink)',
    marginBottom: '16px',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  paragraph: {
    fontFamily: "'Literata', Georgia, serif",
    fontSize: '1rem',
    color: 'var(--ink)',
    lineHeight: '1.8',
    marginBottom: '12px',
  } as React.CSSProperties,
  list: {
    paddingLeft: '20px',
    marginBottom: '12px',
  } as React.CSSProperties,
  listItem: {
    fontFamily: "'Literata', Georgia, serif",
    fontSize: '1rem',
    color: 'var(--ink)',
    lineHeight: '1.8',
    marginBottom: '4px',
  } as React.CSSProperties,
  divider: {
    borderBottom: '1px solid var(--border)',
    marginBottom: '48px',
  } as React.CSSProperties,
  infoCard: {
    background: 'var(--warm)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '24px 28px',
    marginBottom: '12px',
  } as React.CSSProperties,
  infoRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
    fontFamily: "'Cabinet Grotesk', sans-serif",
    fontSize: '0.95rem',
    color: 'var(--ink)',
  } as React.CSSProperties,
  infoLabel: {
    fontWeight: 700,
    minWidth: '180px',
    color: 'var(--muted)',
    flexShrink: 0,
  } as React.CSSProperties,
};

export default function AvisoLegalPage() {
  return (
    <div style={s.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <Link href="/" style={s.breadcrumbLink}>← Volver al inicio</Link>
          <span>·</span>
          <span>Aviso legal</span>
        </div>

        {/* Hero */}
        <div style={s.hero}>
          <h1 style={s.heroTitle}>Aviso legal</h1>
          <p style={s.heroMeta}>En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE)</p>
        </div>

        {/* Identificación del titular */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. Identificación del titular del sitio web</h2>
          <div style={s.infoCard}>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Denominación social</span>
              <span>[Nombre empresa]</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>CIF/NIF</span>
              <span>[CIF]</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Domicilio social</span>
              <span>Barcelona, España</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Correo electrónico</span>
              <a href="mailto:hola@neuropost.es" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>hola@neuropost.es</a>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Registro Mercantil</span>
              <span>[Datos de inscripción]</span>
            </div>
          </div>
        </div>
        <div style={s.divider} />

        {/* Objeto */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. Objeto</h2>
          <p style={s.paragraph}>
            El presente Aviso Legal regula el uso del sitio web <strong>neuropost.es</strong> (en adelante, &quot;el Sitio&quot;),
            del que es titular la entidad indicada en el apartado anterior.
          </p>
          <p style={s.paragraph}>
            El acceso y uso del Sitio implica la aceptación plena y sin reservas de todas las disposiciones incluidas en
            este Aviso Legal. El titular se reserva el derecho a modificarlo en cualquier momento, siendo responsabilidad
            del usuario consultarlo periódicamente.
          </p>
        </div>
        <div style={s.divider} />

        {/* Propiedad intelectual e industrial */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Propiedad intelectual e industrial</h2>
          <p style={s.paragraph}>
            Todos los contenidos del Sitio — incluyendo textos, imágenes, logotipos, diseño, código fuente y estructura —
            son propiedad del titular o de terceros que han autorizado su uso, y están protegidos por las leyes de propiedad
            intelectual e industrial aplicables.
          </p>
          <p style={s.paragraph}>
            Queda expresamente prohibida la reproducción, distribución, transformación o comunicación pública de los
            contenidos del Sitio sin autorización expresa y por escrito del titular.
          </p>
        </div>
        <div style={s.divider} />

        {/* Hosting */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>4. Proveedor de alojamiento</h2>
          <p style={s.paragraph}>El Sitio está alojado en los servidores de:</p>
          <div style={s.infoCard}>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Proveedor</span>
              <span>Vercel Inc.</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Dirección</span>
              <span>340 Pine Street, Suite 701, San Francisco, CA 94104, Estados Unidos</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Sitio web</span>
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>vercel.com</a>
            </div>
          </div>
        </div>
        <div style={s.divider} />

        {/* Legislación aplicable */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>5. Legislación aplicable y jurisdicción</h2>
          <p style={s.paragraph}>
            Este Aviso Legal se rige por la legislación española. Para la resolución de cualquier controversia derivada
            del acceso o uso del Sitio, las partes se someten a los Juzgados y Tribunales de Barcelona, renunciando a
            cualquier otro fuero que pudiera corresponderles.
          </p>
        </div>
      </div>
    </div>
  );
}
