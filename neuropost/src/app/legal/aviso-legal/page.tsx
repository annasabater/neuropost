import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso legal — NeuroPost',
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
  infoCard: {
    background: '#f5f5f5',
    border: '1px solid var(--border)',
    borderRadius: '0px',
    padding: '22px 24px',
    marginBottom: '12px',
  } as React.CSSProperties,
  infoRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
    fontSize: '14px',
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
          <p style={s.heroMeta}>
            Última actualización: 11 de abril de 2026
            <br />
            En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información
            y de Comercio Electrónico (LSSI-CE).
          </p>
        </div>

        {/* 1. Identificación del titular */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. Identificación del titular del sitio web</h2>
          <div style={s.infoCard}>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Nombre comercial</span>
              <span>NeuroPost</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Actividad</span>
              <span>Servicio de gestión de redes sociales para negocios locales</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Domicilio</span>
              <span>Barcelona, España</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Correo electrónico</span>
              <a href="mailto:neuropost.team@gmail.com" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>neuropost.team@gmail.com</a>
            </div>
          </div>
          <p style={s.paragraph}>
            El titular podrá acreditar su identidad e información registral completa ante cualquier solicitud
            legítima, previa petición al correo electrónico indicado.
          </p>
        </div>
        <div style={s.divider} />

        {/* 2. Objeto */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. Objeto</h2>
          <p style={s.paragraph}>
            El presente Aviso Legal regula el uso del sitio web <strong>neuropost.es</strong> (en adelante,
            &quot;el Sitio&quot;), del que es titular la entidad indicada en el apartado anterior.
          </p>
          <p style={s.paragraph}>
            El acceso y uso del Sitio implica la aceptación plena y sin reservas de todas las disposiciones
            incluidas en este Aviso Legal. El titular se reserva el derecho a modificarlo en cualquier momento,
            siendo responsabilidad del usuario consultarlo periódicamente.
          </p>
        </div>
        <div style={s.divider} />

        {/* 3. Propiedad intelectual e industrial */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Propiedad intelectual e industrial</h2>
          <p style={s.paragraph}>
            Todos los contenidos del Sitio — incluyendo textos, imágenes, logotipos, diseño, código fuente y
            estructura — son propiedad del titular o de terceros que han autorizado su uso, y están protegidos
            por las leyes de propiedad intelectual e industrial aplicables.
          </p>
          <p style={s.paragraph}>
            Queda expresamente prohibida la reproducción, distribución, transformación o comunicación pública de
            los contenidos del Sitio sin autorización expresa y por escrito del titular.
          </p>
        </div>
        <div style={s.divider} />

        {/* 4. Contenido generado por IA */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>4. Contenido generado por inteligencia artificial</h2>
          <p style={s.paragraph}>
            NeuroPost ofrece funcionalidades de generación automática de contenido para redes sociales asistidas
            por tecnología de inteligencia artificial.
          </p>
          <p style={s.paragraph}>
            El titular no garantiza que el contenido generado automáticamente sea en todo caso preciso, adecuado
            o libre de errores. Es responsabilidad del usuario revisar, editar y aprobar cualquier contenido antes
            de su publicación. El titular no asume responsabilidad por el contenido que el usuario decida publicar
            en sus redes sociales.
          </p>
        </div>
        <div style={s.divider} />

        {/* 5. Disponibilidad del servicio */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>5. Disponibilidad del servicio</h2>
          <p style={s.paragraph}>
            El titular realizará sus mejores esfuerzos para mantener el Sitio y el servicio disponibles de forma
            continua. Sin embargo, no garantiza la disponibilidad ininterrumpida del mismo, quedando exento de
            responsabilidad por interrupciones derivadas de mantenimiento, fallos técnicos, causas de fuerza mayor
            o circunstancias ajenas a su control.
          </p>
        </div>
        <div style={s.divider} />

        {/* 6. Enlaces a sitios de terceros */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>6. Enlaces a sitios de terceros</h2>
          <p style={s.paragraph}>
            El Sitio puede contener enlaces a sitios web de terceros. Estos enlaces se facilitan únicamente a
            efectos informativos. El titular no controla ni se hace responsable del contenido, políticas de
            privacidad o prácticas de dichos sitios, y su inclusión no implica recomendación ni respaldo alguno.
          </p>
        </div>
        <div style={s.divider} />

        {/* 7. Proveedor de alojamiento */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>7. Proveedor de alojamiento</h2>
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

        {/* 8. Modificaciones del aviso legal */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>8. Modificaciones del aviso legal</h2>
          <p style={s.paragraph}>
            El titular se reserva el derecho a actualizar, modificar o eliminar la información contenida en este
            Aviso Legal en cualquier momento y sin previo aviso. Se recomienda al usuario visitarlo periódicamente.
            Los cambios entrarán en vigor desde el momento de su publicación en el Sitio.
          </p>
        </div>
        <div style={s.divider} />

        {/* 9. Legislación aplicable y jurisdicción */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>9. Legislación aplicable y jurisdicción</h2>
          <p style={s.paragraph}>
            Este Aviso Legal se rige por la legislación española. Para la resolución de cualquier controversia
            derivada del acceso o uso del Sitio, las partes se someten a los Juzgados y Tribunales de Barcelona,
            renunciando a cualquier otro fuero que pudiera corresponderles.
          </p>
        </div>
      </div>
    </div>
  );
}
