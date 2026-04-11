'use client';

import { useRouter } from 'next/navigation';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

const CASES = [
  {
    initials: 'BE',
    name: 'Bar La Esquina',
    type: 'Restaurante · Barcelona',
    quote: 'En 3 meses pasamos de 400 a 1.400 seguidores. Las reservas online subieron un 60%.',
    metrics: [
      { label: 'Seguidores', value: '+240%' },
      { label: 'Reservas online', value: '+60%' },
      { label: 'Engagement', value: '×3.2' },
    ],
    color: '#1D9E75',
  },
  {
    initials: 'SC',
    name: 'Studio Cuts',
    type: 'Barbería · Madrid',
    quote: 'Antes tardaba horas en hacer posts. Ahora NeuroPost lo hace solo y el contenido encaja perfecto con nuestra imagen.',
    metrics: [
      { label: 'Tiempo ahorrado', value: '8h/sem' },
      { label: 'Nuevos clientes', value: '+45%' },
      { label: 'Reach mensual', value: '+180%' },
    ],
    color: '#0F766E',
  },
  {
    initials: 'FN',
    name: 'Flor & Natura',
    type: 'Floristería · Valencia',
    quote: 'Nunca había tenido presencia en redes. A los 2 meses ya teníamos pedidos llegando por Instagram.',
    metrics: [
      { label: 'Pedidos por RRSS', value: '+120%' },
      { label: 'Seguidores', value: '+890' },
      { label: 'Stories vistas', value: '12k/mes' },
    ],
    color: '#065F46',
  },
  {
    initials: 'GM',
    name: 'GymMax',
    type: 'Gimnasio · Bilbao',
    quote: 'El contenido es muy profesional y siempre llega a tiempo. Nuestros socios nos preguntan quién lleva el marketing.',
    metrics: [
      { label: 'Nuevas altas', value: '+35%' },
      { label: 'Seguidores', value: '+1.200' },
      { label: 'Visitas perfil', value: '+300%' },
    ],
    color: '#1D9E75',
  },
  {
    initials: 'CB',
    name: 'Café Bonito',
    type: 'Cafetería · Sevilla',
    quote: 'Probamos 14 días gratis y al cabo de una semana ya era obvio que no íbamos a cancelar.',
    metrics: [
      { label: 'Interacciones', value: '×4' },
      { label: 'Seguidores nuevos', value: '+320/mes' },
      { label: 'Clientes captados', value: '+28%' },
    ],
    color: '#0F766E',
  },
  {
    initials: 'EG',
    name: 'Estética Glow',
    type: 'Centro de estética · Zaragoza',
    quote: 'Lo mejor es que el contenido suena como nosotras. No parece una IA, parece que lo escribimos nosotras mismas.',
    metrics: [
      { label: 'Citas por RRSS', value: '+55%' },
      { label: 'Seguidores', value: '+670' },
      { label: 'Shares en Stories', value: '+200%' },
    ],
    color: '#065F46',
  },
];

export default function CasosDeExitoPage() {
  const router = useRouter();

  return (
    <>
      <LandingNav />

      {/* ─── HERO ─── */}
      <section style={{ background: '#111827', paddingTop: 120, paddingBottom: 80 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#1D9E75', marginBottom: 16 }}>
            Resultados reales
          </div>
          <h1 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(2.4rem,5vw,3.8rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1.0, marginBottom: 20 }}>
            Casos de éxito
          </h1>
          <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 16, color: '#9ca3af', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Negocios que ya confían en NeuroPost para gestionar sus redes sociales.
          </p>

          {/* Aggregate trust bar */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 48, flexWrap: 'wrap' }}>
            {[
              { value: '+500', label: 'Negocios activos' },
              { value: '+12.000', label: 'Posts publicados' },
              { value: '4.9/5', label: 'Valoración media' },
              { value: '8', label: 'Ciudades en España' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: '#1D9E75', letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CASES GRID ─── */}
      <section style={{ background: '#ffffff', padding: '96px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {CASES.map((c) => (
              <div key={c.name} className="fade-in" style={{ border: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', flexDirection: 'column' }}>

                {/* Card header — dark bg with avatar + name */}
                <div style={{ background: '#111827', padding: '24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: '#ffffff', flexShrink: 0 }}>
                    {c.initials}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.name}</div>
                    <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{c.type}</div>
                  </div>
                </div>

                {/* Quote */}
                <div style={{ padding: '20px 24px', flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontStyle: 'italic', color: '#6b7280', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    &ldquo;{c.quote}&rdquo;
                  </p>
                </div>

                {/* Metrics row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e5e7eb', borderTop: '1px solid #e5e7eb' }}>
                  {c.metrics.map(({ label, value }) => (
                    <div key={label} style={{ background: '#f9fafb', padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: c.color, letterSpacing: '-0.02em' }}>{value}</div>
                      <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="cta-final">
        <div className="container">
          <h2>¿Quieres ser el próximo<br />caso de <em>éxito</em>?</h2>
          <p className="cta-sub">14 días gratis. Sin tarjeta de crédito. Sin compromiso.</p>
          <div style={{ marginTop: 24 }}>
            <button
              className="btn-primary"
              onClick={() => router.push('/register')}
              style={{ padding: '16px 36px', fontSize: '1rem' }}
            >
              Empezar ahora →
            </button>
          </div>
          <p className="cta-guarantee">✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin permanencia &nbsp;·&nbsp; ✓ GDPR compliant</p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
