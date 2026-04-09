import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Afiliados y Partners — NeuroPost',
  description: 'Programa de afiliados y colaboraciones para partners, sponsors y creadores que recomiendan NeuroPost.',
};

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function AfiliadosPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <LandingNav />

      <section style={{ padding: '140px 0 56px' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>
            Partners & Colaboraciones
          </div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.3rem, 4.6vw, 4rem)', textTransform: 'uppercase', lineHeight: 0.95, color: '#111111', marginBottom: 14 }}>
            Programa de afiliados
            <br />
            y sponsors
          </h1>
          <p style={{ fontFamily: f, fontSize: 16, color: '#6b7280', lineHeight: 1.75, maxWidth: 760 }}>
            Si recomiendas herramientas a negocios locales o quieres colaborar con NeuroPost como partner,
            aquí tienes una vía clara para generar ingresos y lanzar campañas conjuntas.
          </p>
        </div>
      </section>

      <section style={{ padding: '0 0 80px' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            <article style={{ background: '#ffffff', padding: '26px 22px' }}>
              <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111111', marginBottom: 8 }}>Afiliados</h2>
              <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                Para creadores, freelancers y community managers que recomiendan NeuroPost a sus clientes.
              </p>
            </article>
            <article style={{ background: '#ffffff', padding: '26px 22px' }}>
              <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111111', marginBottom: 8 }}>Sponsors</h2>
              <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                Para marcas y proveedores que quieren visibilidad en nuestra comunidad de negocios locales.
              </p>
            </article>
            <article style={{ background: '#ffffff', padding: '26px 22px' }}>
              <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111111', marginBottom: 8 }}>Partners</h2>
              <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                Para agencias y consultores que quieran vender NeuroPost dentro de su oferta de servicios.
              </p>
            </article>
          </div>

          <div style={{ marginTop: 28, background: '#111111', padding: '28px 24px', border: '1px solid #111111' }}>
            <h3 style={{ fontFamily: fc, fontWeight: 800, fontSize: 26, textTransform: 'uppercase', color: '#ffffff', marginBottom: 8 }}>
              ¿Te interesa colaborar?
            </h3>
            <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', lineHeight: 1.7, marginBottom: 18 }}>
              Cuéntanos tu perfil, audiencia o tipo de colaboración y te respondemos con una propuesta.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <a
                href="mailto:partners@neuropost.es?subject=Colaboracion%20Afiliados%20NeuroPost"
                style={{
                  display: 'inline-block',
                  textDecoration: 'none',
                  background: '#ffffff',
                  color: '#111111',
                  fontFamily: fc,
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '12px 20px',
                }}
              >
                Quiero colaborar
              </a>
              <Link
                href="/pricing"
                style={{
                  display: 'inline-block',
                  textDecoration: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  border: '1px solid #374151',
                  fontFamily: fc,
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '12px 20px',
                }}
              >
                Ver producto
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
