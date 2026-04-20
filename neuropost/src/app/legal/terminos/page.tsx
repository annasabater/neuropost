import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de servicio — NeuroPost',
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

export default function TerminosPage() {
  return (
    <div style={s.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <Link href="/" style={s.breadcrumbLink}>← Volver al inicio</Link>
          <span>·</span>
          <span>Términos de servicio</span>
        </div>

        {/* Hero */}
        <div style={s.hero}>
          <h1 style={s.heroTitle}>Términos de servicio</h1>
          <p style={s.heroMeta}>Última actualización: 1 de abril de 2025</p>
        </div>

        {/* 1. Objeto del servicio */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. Objeto del servicio</h2>
          <p style={s.paragraph}>
            NeuroPost es una plataforma de gestión de redes sociales asistida por inteligencia artificial dirigida a negocios
            locales. A través del servicio, el usuario puede generar, editar, programar y publicar contenido en Instagram
            y Facebook de forma automatizada o semiautomatizada.
          </p>
          <p style={s.paragraph}>
            El acceso al servicio requiere la aceptación íntegra de estos Términos de servicio. Si no estás de acuerdo con
            alguno de sus apartados, no debes utilizar NeuroPost.
          </p>
        </div>
        <div style={s.divider} />

        {/* 2. Condiciones de uso */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. Condiciones de uso</h2>
          <p style={s.paragraph}>Al utilizar NeuroPost, el usuario se compromete a:</p>
          <ul style={s.list}>
            <li style={s.listItem}>Proporcionar información veraz y actualizada durante el registro.</li>
            <li style={s.listItem}>Usar el servicio únicamente para fines lícitos y conforme a la normativa aplicable.</li>
            <li style={s.listItem}>No publicar contenido que infrinja derechos de terceros, sea difamatorio, engañoso o viole las políticas de Instagram y Facebook.</li>
            <li style={s.listItem}>No intentar acceder a áreas restringidas del sistema ni realizar ingeniería inversa sobre la plataforma.</li>
            <li style={s.listItem}>Mantener la confidencialidad de sus credenciales de acceso.</li>
          </ul>
          <p style={s.paragraph}>
            NeuroPost se reserva el derecho de suspender o cancelar cuentas que incumplan estas condiciones, sin previo aviso y
            sin derecho a reembolso.
          </p>
        </div>
        <div style={s.divider} />

        {/* 3. Planes y precios */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Planes y precios</h2>
          <p style={s.paragraph}>
            NeuroPost ofrece distintos planes de suscripción con diferentes funcionalidades y límites de uso. Los precios
            actualizados y las características de cada plan están disponibles en la{' '}
            <Link href="/pricing" style={{ color: 'var(--orange)' }}>página de precios</Link>.
          </p>
          <p style={s.paragraph}>
            Los precios se indican en euros (€) e incluyen el IVA aplicable. NeuroPost se reserva el derecho de modificar sus
            precios con un preaviso mínimo de 30 días a los usuarios activos.
          </p>
        </div>
        <div style={s.divider} />

        {/* 4. Política de cancelación */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>4. Política de cancelación</h2>
          <ul style={s.list}>
            <li style={s.listItem}><strong>Cancela cuando quieras:</strong> puedes cancelar tu suscripción en cualquier momento desde el panel de configuración, sin permanencia mínima ni penalización.</li>
            <li style={s.listItem}><strong>Sin reembolso del mes en curso:</strong> al cancelar, mantendrás el acceso al servicio hasta el final del período de facturación en curso. No se realizan reembolsos proporcionales por los días no utilizados.</li>
            <li style={s.listItem}><strong>Acceso al servicio:</strong> el acceso al servicio está condicionado a la contratación de un plan de pago. Al registrarte, podrás explorar la plataforma hasta completar la suscripción.</li>
          </ul>
        </div>
        <div style={s.divider} />

        {/* 5. Propiedad intelectual */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>5. Propiedad intelectual</h2>
          <p style={s.paragraph}>
            El contenido generado por la plataforma — incluyendo captions, hashtags, ideas y textos — a partir de los
            materiales aportados por el usuario es propiedad del cliente. NeuroPost no reclama ningún derecho de propiedad
            sobre las fotografías, imágenes ni el contenido del negocio que el usuario suba a la plataforma.
          </p>
          <p style={s.paragraph}>
            El usuario garantiza que dispone de los derechos necesarios sobre el contenido que sube a NeuroPost y que su
            publicación no infringe derechos de terceros.
          </p>
          <p style={s.paragraph}>
            El software, diseño, logotipos y demás elementos de la plataforma NeuroPost son propiedad exclusiva de NeuroPost y
            están protegidos por la legislación de propiedad intelectual.
          </p>
        </div>
        <div style={s.divider} />

        {/* 6. Limitación de responsabilidad */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>6. Limitación de responsabilidad</h2>
          <p style={s.paragraph}>
            NeuroPost no garantiza resultados específicos derivados del uso del servicio (incremento de seguidores, ventas u
            otras métricas de negocio). El servicio se presta &quot;tal cual&quot; y &quot;según disponibilidad&quot;.
          </p>
          <p style={s.paragraph}>
            En ningún caso la responsabilidad total de NeuroPost frente al usuario superará el importe abonado por éste durante
            los tres meses anteriores al evento que originó la reclamación.
          </p>
          <p style={s.paragraph}>
            NeuroPost no será responsable de daños indirectos, pérdida de beneficios, pérdida de datos ni daños reputacionales
            derivados del uso o imposibilidad de uso del servicio.
          </p>
        </div>
        <div style={s.divider} />

        {/* 7. Ley aplicable */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>7. Ley aplicable y jurisdicción</h2>
          <p style={s.paragraph}>
            Estos Términos de servicio se rigen por la legislación española. Para la resolución de cualquier controversia
            derivada de la interpretación o ejecución de estos términos, las partes se someten a los Juzgados y Tribunales
            de la ciudad de Barcelona, renunciando expresamente a cualquier otro fuero que pudiera corresponderles.
          </p>
        </div>
      </div>
    </div>
  );
}
