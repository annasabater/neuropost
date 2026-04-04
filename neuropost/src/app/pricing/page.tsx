'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual';

interface Plan {
  name: string;
  monthlyPrice: number;
  desc: string;
  features: string[];
  featured: boolean;
  badge?: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface ComparisonRow {
  feature: string;
  starter: string;
  pro: string;
  total: string;
  agencia: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 29,
    desc: 'Para negocios que empiezan en redes',
    featured: false,
    features: [
      '1 cuenta (Instagram o Facebook)',
      '12 publicaciones al mes',
      'Edición básica de fotos con IA',
      'Captions y hashtags automáticos',
      'Calendario de contenido',
      'Aprobación manual',
      'Soporte por email',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 69,
    desc: 'Para negocios activos que quieren crecer',
    featured: true,
    badge: '⚡ Más popular',
    features: [
      'Instagram + Facebook conectados',
      'Publicaciones ilimitadas',
      'Edición IA avanzada (colores, fondo)',
      'Publicación automática programada',
      'Bandeja de comentarios unificada',
      'Informe mensual en PDF',
      'Ideas de contenido por temporada',
      'Brand Kit completo',
      'Analytics avanzado',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Total',
    monthlyPrice: 129,
    desc: 'Para negocios que quieren máxima presencia y analítica avanzada',
    featured: false,
    badge: '🚀 Completo',
    features: [
      'Instagram + Facebook conectados',
      '7 posts + 7 historias por semana',
      'Edición IA avanzada con estilos visuales',
      'Publicación automática programada',
      'Agente de análisis de competencia',
      'Detección de tendencias del sector',
      'Bandeja de comentarios unificada',
      'Informe mensual en PDF',
      'Brand Kit completo',
      'Analytics avanzado',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Agencia',
    monthlyPrice: 199,
    desc: 'Para agencias y negocios con varias sedes',
    featured: false,
    features: [
      'Hasta 10 marcas / locales',
      'Panel de gestión unificado',
      'Todo lo del plan Pro por cada marca',
      'Roles: admin, editor, aprobador',
      'Informes por cliente exportables',
      'API access (próximamente)',
      'Onboarding personalizado',
      'Soporte prioritario 24 h',
    ],
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Posts por semana',       starter: '2',    pro: '5',           total: '7',             agencia: '7 × marca' },
  { feature: 'Historias por semana',   starter: '—',    pro: '3',           total: '7',             agencia: '7 × marca' },
  { feature: 'Plataformas',            starter: '1',    pro: '2 (IG + FB)', total: '2 (IG + FB)',   agencia: 'Hasta 20' },
  { feature: 'IA para edición de fotos', starter: 'Básica', pro: 'Avanzada', total: 'Avanzada',    agencia: 'Avanzada' },
  { feature: 'Estilos visuales IA',    starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Publicación automática', starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Análisis de competencia',starter: '—',    pro: '—',           total: '✓',             agencia: '✓' },
  { feature: 'Detección de tendencias',starter: '—',    pro: '—',           total: '✓',             agencia: '✓' },
  { feature: 'Bandeja de comentarios', starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Analytics avanzado',     starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Brand Kit',              starter: '—',    pro: '✓',           total: '✓',             agencia: '✓' },
  { feature: 'Gestión multicliente',   starter: '—',    pro: '—',           total: '—',             agencia: '✓' },
  { feature: 'Soporte',                starter: 'Email', pro: 'Prioritario', total: 'Prioritario',  agencia: 'Prioritario 24 h' },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: '¿Puedo cambiar de plan en cualquier momento?',
    a: 'Sí, el cambio es inmediato. Si subes de plan, el cargo proporcional al tiempo restante se aplica al momento. Si bajas, el cambio se efectúa al inicio del siguiente período.',
  },
  {
    q: '¿Qué pasa si cancelo a mitad de mes?',
    a: 'Mantienes el acceso completo hasta el final del período pagado. No se realizan reembolsos parciales, pero puedes exportar todo tu contenido, métricas y brand kit antes de irte.',
  },
  {
    q: '¿Hay descuentos para ONGs o educación?',
    a: 'Sí, tenemos tarifas especiales para entidades sin ánimo de lucro y centros educativos. Escríbenos a hola@neuropost.es con tu documentación y te preparamos una oferta personalizada.',
  },
  {
    q: '¿Puedo pagar con transferencia bancaria?',
    a: 'La transferencia bancaria está disponible únicamente para el plan Agencia con facturación anual. Contáctanos en hola@neuropost.es para gestionar el proceso.',
  },
  {
    q: '¿Qué incluye exactamente el período de prueba?',
    a: 'Acceso completo al plan Pro durante 14 días, sin tarjeta de crédito. Puedes conectar tus redes, generar posts, activar la publicación automática y probar todas las funciones sin límite.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function annualPrice(monthly: number): number {
  return Math.round(monthly * 0.8);
}

function annualSavings(monthly: number): number {
  return Math.round((monthly - annualPrice(monthly)) * 12);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavBar() {
  const [navShadow, setNavShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav style={{ boxShadow: navShadow ? '0 4px 20px rgba(0,0,0,0.06)' : 'none' }}>
      <Link href="/" className="nav-logo">
        <span className="logo-dot" />
        NeuroPost
      </Link>
      <ul className="nav-links">
        <li><Link href="/#funciones">Funciones</Link></li>
        <li><Link href="/#como-funciona">Cómo funciona</Link></li>
        <li><Link href="/pricing" style={{ color: 'var(--orange)', fontWeight: 700 }}>Precios</Link></li>
        <li><Link href="/#faq">FAQ</Link></li>
        <li><Link href="/about">Nosotros</Link></li>
        <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
        <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
      </ul>
    </nav>
  );
}

function FooterSection() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="nav-logo" style={{ color: 'var(--cream)' }}>
              <span className="logo-dot" />
              NeuroPost
            </Link>
            <p>IA para que los negocios locales gestionen sus redes sociales sin esfuerzo. Hecho con ❤️ en España.</p>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📧 hola@neuropost.es</a>
              <a href="tel:+34XXXXXXXXX" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📞 +34 XXX XXX XXX</a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Producto</div>
            <ul className="footer-links">
              <li><Link href="/#funciones">Funciones</Link></li>
              <li><Link href="/#como-funciona">Cómo funciona</Link></li>
              <li><Link href="/pricing">Precios</Link></li>
              <li><a href="#">Changelog</a></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Empresa</div>
            <ul className="footer-links">
              <li><Link href="/about">Sobre nosotros</Link></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Afiliados</a></li>
              <li><Link href="/about#contacto">Contacto</Link></li>
              <li><a href="mailto:jobs@neuropost.es">Trabaja con nosotros</a></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Legal</div>
            <ul className="footer-links">
              <li><Link href="/legal/privacidad">Privacidad</Link></li>
              <li><Link href="/legal/terminos">Términos</Link></li>
              <li><Link href="/legal/cookies">Cookies</Link></li>
              <li><Link href="/legal/aviso-legal">Aviso legal</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 NeuroPost · Todos los derechos reservados</span>
          <span>Hecho en Barcelona 🇪🇸</span>
        </div>
      </div>
    </footer>
  );
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

function RoiCalculator() {
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [minsPerPost, setMinsPerPost] = useState(45);

  const currentMonthlyMins = postsPerWeek * 4 * minsPerPost;
  const currentMonthlyHours = currentMonthlyMins / 60;
  const withNeuroPostHours = currentMonthlyHours * 0.1;
  const savedHours = currentMonthlyHours - withNeuroPostHours;
  const savedDays = savedHours / 8;

  return (
    <section
      style={{
        padding: '100px 0',
        background: 'var(--warm)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="section-eyebrow">ROI real</div>
          <h2>Calcula tu ahorro</h2>
          <p className="section-sub" style={{ margin: '12px auto 0', textAlign: 'center' }}>
            Descubre cuánto tiempo (y dinero) recuperas cada mes.
          </p>
        </div>

        <div
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            background: 'white',
            border: '1.5px solid var(--border)',
            borderRadius: '20px',
            padding: '48px',
          }}
        >
          {/* Slider 1 */}
          <div style={{ marginBottom: '36px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                }}
              >
                ¿Cuántas veces publicas por semana?
              </label>
              <span
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  color: 'var(--orange)',
                }}
              >
                {postsPerWeek}×
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              value={postsPerWeek}
              onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer', height: '6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.78rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              <span>1 vez</span>
              <span>7 veces</span>
            </div>
          </div>

          {/* Slider 2 */}
          <div style={{ marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                }}
              >
                ¿Cuántos minutos tardas por publicación?
              </label>
              <span
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '1.4rem',
                  color: 'var(--orange)',
                }}
              >
                {minsPerPost} min
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={minsPerPost}
              onChange={(e) => setMinsPerPost(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer', height: '6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.78rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              <span>10 min</span>
              <span>2 horas</span>
            </div>
          </div>

          {/* Results */}
          <div
            style={{
              background: 'var(--warm)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '28px 32px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  marginBottom: '6px',
                }}
              >
                Tiempo actual al mes
              </div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em',
                }}
              >
                {currentMonthlyHours.toFixed(1)} h
              </div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                }}
              >
                {postsPerWeek} posts/sem × 4 semanas × {minsPerPost} min
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  marginBottom: '6px',
                }}
              >
                Con NeuroPost (90% menos)
              </div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em',
                }}
              >
                {withNeuroPostHours.toFixed(1)} h
              </div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                }}
              >
                Solo revisar y aprobar
              </div>
            </div>

            {/* Savings highlight — full width */}
            <div
              style={{
                gridColumn: 'span 2',
                background: 'var(--ink)',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(250,248,243,0.5)',
                    marginBottom: '4px',
                  }}
                >
                  Ahorro mensual
                </div>
                <div
                  style={{
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: '2.2rem',
                    fontWeight: 900,
                    color: '#ff5c1a',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}
                >
                  {savedHours.toFixed(1)} horas
                </div>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.9rem',
                  color: 'rgba(250,248,243,0.6)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ff5c1a', letterSpacing: '-0.02em' }}>
                  {savedDays.toFixed(1)} días
                </div>
                <div>de trabajo al mes</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px', color: 'rgba(250,248,243,0.4)' }}>
                  calculado a 8 h/día
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [openFaq, setOpenFaq] = useState<number>(-1);

  const isAnnual = billing === 'annual';

  function displayPrice(plan: Plan): number {
    return isAnnual ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice;
  }

  return (
    <>
      {/* ─── NAV ─── */}
      <NavBar />

      {/* ─── HERO ─── */}
      <section
        style={{
          background: 'var(--ink)',
          color: 'var(--cream)',
          padding: '140px 0 80px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,92,26,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="container" style={{ position: 'relative' }}>
          <div className="section-eyebrow" style={{ color: 'rgba(255,92,26,0.8)', display: 'inline-block' }}>
            Sin sorpresas
          </div>
          <h2
            style={{
              color: 'var(--cream)',
              fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
              marginBottom: '16px',
              marginTop: '12px',
            }}
          >
            Precios claros.<br />Cancela cuando quieras.
          </h2>
          <p
            style={{
              color: 'rgba(250,248,243,0.55)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              maxWidth: '480px',
              margin: '0 auto 40px',
            }}
          >
            14 días gratis en todos los planes. Sin tarjeta de crédito. Sin permanencia.
          </p>

          {/* Billing toggle */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(250,248,243,0.08)',
              border: '1px solid rgba(250,248,243,0.12)',
              borderRadius: '40px',
              padding: '4px',
              gap: '4px',
            }}
          >
            {(['monthly', 'annual'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBilling(cycle)}
                style={{
                  padding: '9px 22px',
                  borderRadius: '36px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  transition: 'all 0.2s',
                  background: billing === cycle ? 'var(--orange)' : 'transparent',
                  color: billing === cycle ? 'white' : 'rgba(250,248,243,0.5)',
                }}
              >
                {cycle === 'monthly' ? 'Mensual' : 'Anual'}
                {cycle === 'annual' && (
                  <span
                    style={{
                      marginLeft: '6px',
                      background: billing === 'annual' ? 'rgba(255,255,255,0.2)' : 'rgba(255,92,26,0.25)',
                      color: billing === 'annual' ? 'white' : 'var(--orange)',
                      borderRadius: '20px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING GRID ─── */}
      <section
        style={{
          background: 'var(--warm)',
          padding: '80px 0 100px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container">
          <div className="pricing-grid">
            {PLANS.map((plan) => {
              const price = displayPrice(plan);
              const savings = annualSavings(plan.monthlyPrice);

              return (
                <div key={plan.name} className={`plan${plan.featured ? ' featured' : ''}`}>
                  {plan.badge && <div className="plan-badge">{plan.badge}</div>}
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price">
                    <sup>€</sup>
                    {price}
                    <span>/mes</span>
                  </div>

                  {/* Annual savings badge */}
                  {isAnnual && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: plan.featured ? 'rgba(255,92,26,0.2)' : 'var(--orange-light)',
                        color: plan.featured ? '#ffb899' : 'var(--orange)',
                        fontFamily: "'Cabinet Grotesk', sans-serif",
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        marginBottom: '8px',
                      }}
                    >
                      Ahorras €{savings}/año
                    </div>
                  )}

                  <div className="plan-desc">{plan.desc}</div>
                  <ul className="plan-features">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="plan-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    Empezar gratis →
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="pricing-note">
            🔒 Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section style={{ padding: '100px 0', background: 'var(--cream)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="section-eyebrow">Comparativa</div>
            <h2>¿Qué incluye cada plan?</h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                maxWidth: '820px',
                margin: '0 auto',
                borderCollapse: 'collapse',
                fontFamily: "'Cabinet Grotesk', sans-serif",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--muted)',
                      borderBottom: '2px solid var(--border)',
                    }}
                  >
                    Función
                  </th>
                  {(['Starter', 'Pro', 'Total', 'Agencia'] as const).map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: col === 'Pro' ? 'var(--orange)' : 'var(--ink)',
                        borderBottom: '2px solid var(--border)',
                        background: col === 'Pro' ? 'rgba(255,92,26,0.04)' : 'transparent',
                        borderRadius: col === 'Pro' ? '8px 8px 0 0' : undefined,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{ background: i % 2 === 0 ? 'white' : 'var(--warm)' }}
                  >
                    <td
                      style={{
                        padding: '14px 20px',
                        fontSize: '0.9rem',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.feature}
                    </td>
                    {([row.starter, row.pro, row.total, row.agencia] as const).map((val, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '14px 20px',
                          textAlign: 'center',
                          borderBottom: '1px solid var(--border)',
                          background: j === 1 ? 'rgba(255,92,26,0.04)' : undefined,
                          color:
                            val === '✓'
                              ? 'var(--green)'
                              : val === '—'
                                ? 'var(--border)'
                                : 'var(--ink)',
                          fontWeight: val === '✓' || val === '—' ? 900 : 500,
                          fontSize: val === '✓' || val === '—' ? '1rem' : '0.88rem',
                        }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── ROI CALCULATOR ─── */}
      <RoiCalculator />

      {/* ─── FAQ ─── */}
      <section
        style={{
          padding: '100px 0',
          background: 'var(--cream)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="container">
          <div className="faq-grid">
            <div className="faq-sidebar">
              <div className="section-eyebrow">FAQ</div>
              <h2>Preguntas sobre precios</h2>
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: '0.92rem',
                  lineHeight: '1.7',
                  marginTop: '12px',
                }}
              >
                ¿Más dudas? Escríbenos a{' '}
                <a href="mailto:hola@neuropost.es" style={{ color: 'var(--orange)' }}>
                  hola@neuropost.es
                </a>
              </p>
            </div>
            <div className="faq-list">
              {FAQ_ITEMS.map(({ q, a }, i) => (
                <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                  <button
                    className="faq-question"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  >
                    {q}
                    <span className="faq-icon">+</span>
                  </button>
                  <div className="faq-answer">{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST SECTION ─── */}
      <section
        style={{
          padding: '60px 0',
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '28px',
              textAlign: 'center',
            }}
          >
            {/* Payment logos row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {['Visa', 'Mastercard', 'SEPA', 'Stripe'].map((brand) => (
                <div
                  key={brand}
                  style={{
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: 'var(--muted)',
                    letterSpacing: '-0.01em',
                    padding: '8px 20px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    background: 'white',
                  }}
                >
                  {brand}
                </div>
              ))}
            </div>

            {/* PCI badge */}
            <div
              style={{
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontSize: '0.85rem',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '1rem' }}>🔒</span>
              Pago procesado por Stripe · Certificado PCI DSS
            </div>

            {/* Money-back guarantee */}
            <div
              style={{
                background: 'white',
                border: '1.5px solid var(--border)',
                borderRadius: '14px',
                padding: '20px 32px',
                maxWidth: '480px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--green-light)',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <p
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: '0.9rem',
                  color: 'var(--ink)',
                  lineHeight: 1.6,
                  margin: 0,
                  textAlign: 'left',
                }}
              >
                <strong>Garantía 14 días.</strong> Si no ves valor, te devolvemos el dinero. Sin preguntas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="cta-final">
        <div className="container">
          <h2>
            Empieza hoy y recupera<br /><em>horas de tu semana</em>
          </h2>
          <p className="cta-sub">14 días gratis. Sin tarjeta de crédito. Sin permanencia.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', position: 'relative' }}>
            <Link
              href="/register"
              style={{
                padding: '14px 32px',
                background: 'var(--orange)',
                color: 'white',
                borderRadius: '40px',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: '1rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                display: 'inline-block',
              }}
            >
              Crear cuenta gratis →
            </Link>
            <Link
              href="/pricing"
              style={{
                padding: '14px 32px',
                background: 'transparent',
                color: 'rgba(250,248,243,0.6)',
                border: '1.5px solid rgba(250,248,243,0.15)',
                borderRadius: '40px',
                fontFamily: "'Cabinet Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Ver planes
            </Link>
          </div>
          <p className="cta-guarantee">
            ✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin permanencia &nbsp;·&nbsp; ✓ GDPR compliant
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <FooterSection />
    </>
  );
}
