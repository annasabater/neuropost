import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de privacidad — NeuroPost',
};

const legalStyles = {
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

export default function PrivacidadPage() {
  return (
    <div style={legalStyles.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={legalStyles.breadcrumb}>
          <Link href="/" style={legalStyles.breadcrumbLink}>← Volver al inicio</Link>
          <span>·</span>
          <span>Política de privacidad</span>
        </div>

        {/* Hero */}
        <div style={legalStyles.hero}>
          <h1 style={legalStyles.heroTitle}>Política de privacidad</h1>
          <p style={legalStyles.heroMeta}>Última actualización: 1 de abril de 2025</p>
        </div>

        {/* Responsable del tratamiento */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>1. Responsable del tratamiento</h2>
          <p style={legalStyles.paragraph}>
            El responsable del tratamiento de los datos personales recogidos a través de este sitio web es:
          </p>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Denominación social:</strong> [Nombre empresa]</li>
            <li style={legalStyles.listItem}><strong>CIF/NIF:</strong> [CIF]</li>
            <li style={legalStyles.listItem}><strong>Domicilio social:</strong> Barcelona, España</li>
            <li style={legalStyles.listItem}><strong>Correo electrónico de contacto:</strong> <a href="mailto:privacidad@neuropost.es" style={{ color: 'var(--orange)' }}>privacidad@neuropost.es</a></li>
          </ul>
        </div>
        <div style={legalStyles.divider} />

        {/* Datos que recogemos */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>2. Datos que recogemos</h2>
          <p style={legalStyles.paragraph}>
            En función del uso que hagas de NeuroPost, tratamos las siguientes categorías de datos personales:
          </p>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Cuenta:</strong> nombre y dirección de correo electrónico para crear y gestionar tu cuenta.</li>
            <li style={legalStyles.listItem}><strong>Pago:</strong> la información de pago es gestionada íntegramente por Stripe, Inc. NeuroPost no almacena datos de tarjeta de crédito.</li>
            <li style={legalStyles.listItem}><strong>Contenido del negocio:</strong> fotos e imágenes que subes para generar publicaciones.</li>
            <li style={legalStyles.listItem}><strong>Tokens de acceso:</strong> tokens de autenticación de Instagram y Facebook, necesarios para publicar en tu nombre.</li>
            <li style={legalStyles.listItem}><strong>Datos de uso:</strong> registros de actividad, páginas visitadas, funciones utilizadas y preferencias de configuración.</li>
          </ul>
        </div>
        <div style={legalStyles.divider} />

        {/* Base legal */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>3. Base legal del tratamiento</h2>
          <p style={legalStyles.paragraph}>El tratamiento de tus datos se ampara en las siguientes bases legales:</p>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Ejecución de un contrato:</strong> para prestarte el servicio de NeuroPost conforme a los Términos de servicio aceptados.</li>
            <li style={legalStyles.listItem}><strong>Consentimiento:</strong> para el envío de comunicaciones comerciales y el uso de cookies analíticas no esenciales.</li>
            <li style={legalStyles.listItem}><strong>Interés legítimo:</strong> para la detección de fraude, seguridad del servicio y mejora de funcionalidades.</li>
          </ul>
        </div>
        <div style={legalStyles.divider} />

        {/* Conservación de datos */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>4. Conservación de datos</h2>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Datos de cuenta:</strong> durante la vigencia de la cuenta activa y 3 años adicionales tras su cancelación.</li>
            <li style={legalStyles.listItem}><strong>Datos de pago:</strong> gestionados y conservados por Stripe según su propia política de retención.</li>
            <li style={legalStyles.listItem}><strong>Registros de actividad (logs):</strong> 12 meses desde su generación.</li>
          </ul>
        </div>
        <div style={legalStyles.divider} />

        {/* Derechos del usuario */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>5. Tus derechos</h2>
          <p style={legalStyles.paragraph}>
            Como interesado, puedes ejercer en cualquier momento los siguientes derechos ante el responsable del tratamiento:
          </p>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Acceso:</strong> conocer qué datos personales tratamos sobre ti.</li>
            <li style={legalStyles.listItem}><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li style={legalStyles.listItem}><strong>Supresión:</strong> solicitar la eliminación de tus datos cuando ya no sean necesarios.</li>
            <li style={legalStyles.listItem}><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
            <li style={legalStyles.listItem}><strong>Oposición:</strong> oponerte al tratamiento basado en interés legítimo.</li>
          </ul>
          <p style={legalStyles.paragraph}>
            Para ejercer cualquiera de estos derechos, escríbenos a{' '}
            <a href="mailto:privacidad@neuropost.es" style={{ color: 'var(--orange)' }}>privacidad@neuropost.es</a>{' '}
            con el asunto &quot;Ejercicio de derechos RGPD&quot;.
          </p>
        </div>
        <div style={legalStyles.divider} />

        {/* Reclamación ante la AEPD */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>6. Reclamación ante la AEPD</h2>
          <p style={legalStyles.paragraph}>
            Si consideras que el tratamiento de tus datos no es conforme al Reglamento General de Protección de Datos, tienes
            derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) a través de su
            sitio web:{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
              www.aepd.es
            </a>.
          </p>
        </div>
        <div style={legalStyles.divider} />

        {/* Transferencias internacionales */}
        <div style={legalStyles.section}>
          <h2 style={legalStyles.sectionTitle}>7. Transferencias internacionales</h2>
          <p style={legalStyles.paragraph}>
            Para prestar el servicio utilizamos proveedores que pueden tratar datos fuera del Espacio Económico Europeo. En
            todos los casos, nos aseguramos de que existan garantías adecuadas mediante cláusulas contractuales tipo aprobadas
            por la Comisión Europea:
          </p>
          <ul style={legalStyles.list}>
            <li style={legalStyles.listItem}><strong>Supabase:</strong> infraestructura de base de datos y autenticación.</li>
            <li style={legalStyles.listItem}><strong>Stripe, Inc.:</strong> procesamiento de pagos.</li>
            <li style={legalStyles.listItem}><strong>Anthropic, PBC:</strong> generación de contenido mediante inteligencia artificial.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
