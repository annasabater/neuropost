import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de servicio — NeuroPost',
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
            <Link href="/#precios" style={{ color: 'var(--orange)' }}>página de precios</Link>.
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
            <li style={s.listItem}><strong>Período de prueba:</strong> todos los planes incluyen 14 días de prueba gratuita sin necesidad de tarjeta de crédito. Al finalizar el período de prueba, el servicio quedará suspendido hasta que introduzcas un método de pago válido.</li>
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
