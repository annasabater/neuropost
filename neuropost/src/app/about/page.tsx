'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

// ─── Counter hook ─────────────────────────────────────────────────────────────

function useCounter(target: number, duration = 1500, active = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return value;
}

// ─── Stat card with animated counter ─────────────────────────────────────────

interface StatDef { target?: number; display?: string; prefix?: string; label: string }

function StatCard({ stat, active }: { stat: StatDef; active: boolean }) {
  const count = useCounter(stat.target ?? 0, 1500, active && stat.target !== undefined);
  const shown = stat.display ?? `${stat.prefix ?? ''}${stat.target !== undefined ? count.toLocaleString('es-ES') : ''}`;
  return (
    <div style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.4rem)', color: 'var(--orange)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {shown}
      </div>
      <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>{stat.label}</div>
    </div>
  );
}

const STATS: StatDef[] = [
  { target: 200,   prefix: '+',  label: 'negocios activos' },
  { target: 12000, prefix: '+',  label: 'posts publicados' },
  { display: '4.9/5',            label: 'valoración media' },
  { target: 8,                   label: 'ciudades en España' },
];

// ─── Team member card ─────────────────────────────────────────────────────────

function TeamCard({ initials, name, role, quote }: { initials: string; name: string; role: string; quote: string }) {
  return (
    <div className="fade-in" style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Avatar block */}
      <div style={{ background: '#111827', padding: '28px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: '#ffffff', flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{name}</div>
          <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{role}</div>
        </div>
      </div>
      {/* Quote */}
      <div style={{ padding: '20px 24px' }}>
        <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontStyle: 'italic', color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>&ldquo;{quote}&rdquo;</p>
      </div>
    </div>
  );
}

// ─── Value card ───────────────────────────────────────────────────────────────

function ValueCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="fade-in" style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#111827', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h3 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", color: '#6b7280', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Contact info card ────────────────────────────────────────────────────────

function ContactCard({ icon, title, value, sub, href }: { icon: React.ReactNode; title: string; value: string; sub?: string; href: string }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: 0, background: '#ffffff', border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'border-color 0.15s', overflow: 'hidden' }}>
      <div style={{ width: 52, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{title}</div>
        <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 700, color: '#111827', fontSize: 14 }}>{value}</div>
        {sub && <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      </div>
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BUSINESS_TYPES = ['Heladería', 'Restaurante', 'Cafetería', 'Gym', 'Clínica', 'Barbería', 'Boutique', 'Inmobiliaria', 'Floristería', 'Otro'];
const SUBJECTS = [
  { value: 'empezar', label: 'Empezar con NeuroPost', desc: 'Quiero que gestionéis mis redes' },
  { value: 'cuenta', label: 'Gestionar mi cuenta', desc: 'Tengo una cuenta activa' },
  { value: 'tecnico', label: 'Problema técnico', desc: 'Algo no funciona correctamente' },
  { value: 'colaboracion', label: 'Colaboraciones', desc: 'Afiliación o partnership' },
  { value: 'otro', label: 'Otro', desc: '' },
];

export default function AboutPage() {
  const router = useRouter();
  const [navShadow, setNavShadow]     = useState(false);
  const [statsActive, setStatsActive] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Contact form state
  const [form, setForm]       = useState({ name: '', email: '', phone: '', business_type: '', subject: '', message: '', privacy: false });
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [formError, setFormError] = useState('');

  // Nav scroll shadow
  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-reveal + stats counter
  useEffect(() => {
    const fadeObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObserver.unobserve(e.target); } }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.fade-in').forEach((el) => fadeObserver.observe(el));

    const statsEl = statsRef.current;
    if (statsEl) {
      const statsObserver = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { setStatsActive(true); statsObserver.disconnect(); } },
        { threshold: 0.4 },
      );
      statsObserver.observe(statsEl);
      return () => { fadeObserver.disconnect(); statsObserver.disconnect(); };
    }
    return () => fadeObserver.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) { setFormError('Por favor rellena todos los campos requeridos.'); return; }
    if (!form.privacy) { setFormError('Debes aceptar la política de privacidad.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error'); }
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al enviar. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    border: '1.5px solid var(--border)', borderRadius: 10,
    fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.95rem',
    background: 'var(--surface)', color: 'var(--ink)',
    outline: 'none', transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: "'Cabinet Grotesk',sans-serif",
    fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)', marginBottom: 6,
  };

  return (
    <>
      {/* ─── NAV ─── */}
      <LandingNav />

      {/* ─── HERO ─── */}
      <section style={{ background: 'var(--ink)', paddingTop: 120, paddingBottom: 96, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 80% 50%, rgba(15,118,110,0.12) 0%, transparent 70%)' }} />
        <div className="container" style={{ position: 'relative', textAlign: 'center', maxWidth: 720 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(15,118,110,0.15)', border: '1px solid rgba(15,118,110,0.3)', color: '#0F766E', padding: '5px 12px', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, background: '#0F766E' }} />
            <span />
            Sobre nosotros
          </div>
          <h1 style={{ color: 'white', marginBottom: 24 }}>
            Somos el equipo que lleva<br />las redes de <em>tu negocio</em>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            Nacimos en Barcelona con una idea simple: los dueños de negocios locales no deberían perder
            horas gestionando redes sociales. Nosotros nos encargamos.
          </p>
        </div>
      </section>

      {/* ─── 1. HERO STATEMENT ─── */}
      <section className="fade-in" style={{ background: '#ffffff', padding: '96px 0 64px' }}>
        <div className="container" style={{ maxWidth: 900, textAlign: 'center' }}>
          <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, color: '#111827', margin: 0 }}>
            Nos encargamos de tus redes.<br />Tú de tu negocio.
          </p>
        </div>
      </section>

      {/* ─── 2. INTRO ─── */}
      <section className="fade-in" style={{ background: '#ffffff', paddingBottom: 80 }}>
        <div className="container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 17, color: '#6b7280', lineHeight: 1.8, margin: 0 }}>
            Negocios que ya funcionan, pero que pueden escalar aún más cuando su imagen digital está a la altura de lo que realmente ofrecen.<br />
            Porque hoy, el primer contacto con tu marca ocurre mucho antes de entrar.
          </p>
        </div>
      </section>

      {/* ─── 3. SPLIT — text + visual ─── */}
      <section className="fade-in" style={{ background: '#f5f5f5', padding: '80px 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 16 }}>Nuestra historia</div>
            <h2 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', textTransform: 'uppercase', color: '#111827', lineHeight: 1.0, marginBottom: 24 }}>
              Por qué existe NeuroPost
            </h2>
            <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 15, color: '#6b7280', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0 }}>NeuroPost nace observando algo que nos llamó la atención: negocios increíbles con una presencia digital que no les hacía justicia.</p>
              <p style={{ margin: 0 }}>Hoteles, academias, museos, centros deportivos, restaurantes, tiendas, clínicas, agencias… cualquier negocio que quiera crecer en redes sin perder tiempo en gestionarlas.</p>
              <p style={{ margin: 0, color: '#111827', fontWeight: 600 }}>Ahí es donde decidimos aportar valor.</p>
              <p style={{ margin: 0 }}>Nos encargamos de toda la gestión para que tu negocio tenga una presencia cuidada, constante y profesional, sin que le dediques tiempo.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&q=80&auto=format&fit=crop" alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&q=80&auto=format&fit=crop" alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&q=80&auto=format&fit=crop" alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=300&q=80&auto=format&fit=crop" alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      </section>

      {/* ─── 4. VALUE BLOCKS ─── */}
      <section className="fade-in" style={{ background: '#ffffff', padding: '80px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            {[
              { title: 'Más visibilidad', desc: 'Tu negocio aparece donde tus clientes buscan' },
              { title: 'Más confianza', desc: 'Transmites calidad desde el primer vistazo' },
              { title: 'Más clientes', desc: 'Lo que ven en redes les lleva a visitarte' },
              { title: 'Menos trabajo', desc: 'Nosotros nos encargamos de todo' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ background: '#ffffff', padding: '28px 24px' }}>
                <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: '#111827', marginBottom: 6 }}>{title}</p>
                <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. EMPHASIS STATEMENT ─── */}
      <section className="fade-in" style={{ background: '#111827', padding: '80px 0' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 700 }}>
          <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1.0, margin: 0 }}>
            No se trata de hacer más.<br />Se trata de que lo que ya haces… se vea.
          </p>
        </div>
      </section>

      {/* ─── 6. CLOSING ─── */}
      <section className="fade-in" style={{ background: '#ffffff', padding: '80px 0' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 640 }}>
          <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 17, color: '#6b7280', lineHeight: 1.8, marginBottom: 24 }}>
            Hoy ayudamos a negocios en toda España a reforzar su presencia digital y convertirla en una herramienta real de crecimiento.
          </p>
          <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', textTransform: 'uppercase', color: '#111827', lineHeight: 1.2, margin: 0 }}>
            Que tú sigas haciendo crecer tu negocio dentro, y nosotros nos encargamos de hacerlo crecer también fuera.
          </p>
          <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, fontStyle: 'italic', color: '#9ca3af', marginTop: 20 }}>
            Esto no va de publicar por publicar. Va de hacer que lo que ya tienes… destaque como merece.
          </p>
        </div>
      </section>

      {/* ─── VALORES ─── */}
      <section id="valores" style={{ background: '#f5f5f5', padding: '96px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 12 }}>Lo que nos guía</div>
            <h2 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', letterSpacing: '0.01em', textTransform: 'uppercase', color: '#111827', lineHeight: 1.0 }}>
              Nuestros valores
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            <ValueCard icon="✨" title="Simplicidad" desc="Creemos que la tecnología debe simplificar la vida, no complicarla. Si algo no es fácil de usar, lo rediseñamos hasta que lo sea." />
            <ValueCard icon="📈" title="Resultados reales" desc="No medimos funcionalidades. Medimos más clientes, más ventas y más tiempo para lo que de verdad importa." />
            <ValueCard icon="🤝" title="Transparencia" desc="Sin contratos largos, sin letra pequeña, sin sorpresas en la factura. Precio claro, resultado claro, cancela cuando quieras." />
          </div>
        </div>
      </section>

      {/* ─── EQUIPO ─── */}
      <section id="equipo" style={{ background: 'var(--cream)', padding: '96px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-eyebrow">El equipo</div>
            <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1.1 }}>
              Las personas detrás de NeuroPost
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, marginBottom: 48 }}>
            <TeamCard initials="AS" name="Anna Sabater Nualart" role="Co-fundadora & CEO" quote="Obsesionada con hacer que las cosas funcionen de verdad." />
            <TeamCard initials="SM" name="Samuel Marín Ibarz" role="Co-fundador & CTO" quote="Si no está automatizado, no está terminado." />
            <TeamCard initials="LR" name="[Nombre de Diseño]" role="Diseño de producto" quote="El diseño es la primera capa de confianza." />
          </div>
          <div style={{ background: '#111827', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: '#ffffff', marginBottom: 4 }}>¿Quieres formar parte del equipo?</p>
              <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#9ca3af' }}>Buscamos personas con ganas de cambiar las reglas del juego</p>
            </div>
            <a href="mailto:neuropost.team@gmail.com" style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', background: '#ffffff', padding: '10px 24px', textDecoration: 'none', flexShrink: 0 }}>
              neuropost.team@gmail.com →
            </a>
          </div>
        </div>
      </section>

      {/* ─── CONTACTO ─── */}
      <section id="contacto" style={{ background: '#ffffff', padding: '96px 0' }}>
        <div className="container">
          <div className="contact-grid">

            {/* Left: info */}
            <div className="fade-in">
              <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 16 }}>Contacto</div>
              <h2 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', textTransform: 'uppercase', color: '#111827', marginBottom: 16, lineHeight: 1.0 }}>
                Hablemos
              </h2>
              <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", color: '#6b7280', lineHeight: 1.75, marginBottom: 32, fontSize: 15 }}>
                ¿Tienes alguna pregunta? ¿Quieres ver una demo? Escríbenos y te respondemos en menos de 24 horas.
              </p>

              {/* Trust bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: 32 }}>
                {[
                  { metric: '+500', label: 'Negocios activos' },
                  { metric: '<24h', label: 'Respuesta garantizada' },
                  { metric: '4.9★', label: 'Valoración media' },
                ].map(({ metric, label }) => (
                  <div key={label} style={{ background: '#f9fafb', padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: '#111827', letterSpacing: '-0.02em' }}>{metric}</div>
                    <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid #e5e7eb', marginBottom: 32 }}>
                <ContactCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}
                  title="Email"
                  value="neuropost.team@gmail.com"
                  href="mailto:neuropost.team@gmail.com"
                />
                <ContactCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                  title="Teléfono principal"
                  value="616 77 34 66"
                  sub="Lunes a viernes, 9:00 – 18:00"
                  href="tel:+34616773466"
                />
                <ContactCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                  title="Teléfono secundario"
                  value="672 83 66 66"
                  sub="Lunes a viernes, 9:00 – 18:00"
                  href="tel:+34672836666"
                />
                <ContactCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
                  title="Ubicación"
                  value="Barcelona, España"
                  sub="Solo con cita previa"
                  href="https://maps.google.com/?q=Barcelona"
                />
              </div>

              {/* Horario — clean list */}
              <div style={{ border: '1px solid #e5e7eb', marginBottom: 24 }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>Horario de atención</span>
                </div>
                {[['Lunes – Viernes', '9:00 – 18:00'], ['Sábados y Domingos', 'Cerrado']].map(([d, h], i) => (
                  <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#6b7280' }}>{d}</span>
                    <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' }}>{h}</span>
                  </div>
                ))}
              </div>

              <div className="contact-social-links">
                <a href="https://instagram.com/neuropost.es" target="_blank" rel="noopener noreferrer" className="contact-social-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  @neuropost.es
                </a>
                <a href="https://linkedin.com/company/neuropost" target="_blank" rel="noopener noreferrer" className="contact-social-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                  LinkedIn
                </a>
              </div>
            </div>

            {/* Right: form — sticky on desktop */}
            <div className="contact-form-col fade-in">
              <div style={{ border: '1px solid #e5e7eb', background: '#ffffff' }}>
                {sent ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ width: 48, height: 48, background: '#f0fdf4', border: '2px solid #0F766E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <p style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Mensaje enviado</p>
                    <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", color: '#6b7280', fontSize: 14 }}>Te respondemos en menos de 24 horas.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e5e7eb' }}>
                      <div style={{ padding: '16px 20px', background: '#ffffff' }}>
                        <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Nombre *</label>
                        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tu nombre" required
                          style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, color: '#111827', outline: 'none', background: 'none' }} />
                      </div>
                      <div style={{ padding: '16px 20px', background: '#ffffff' }}>
                        <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Email *</label>
                        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="tu@email.com" required
                          style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, color: '#111827', outline: 'none', background: 'none' }} />
                      </div>
                    </div>
                    {/* Teléfono */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Teléfono</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000"
                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, color: '#111827', outline: 'none', background: 'none', boxSizing: 'border-box' }} />
                    </div>
                    {/* Tipo de negocio */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>Tipo de negocio</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                        {[
                          { v: 'Restaurante', icon: '🍽' }, { v: 'Hotel / Hostal', icon: '🏨' }, { v: 'Museo / Cultura', icon: '🏛️' },
                          { v: 'Academia', icon: '📚' }, { v: 'Gym / Deporte', icon: '🏋️' }, { v: 'Aventura', icon: '🧗' },
                          { v: 'Tienda / Moda', icon: '👗' }, { v: 'Salud / Clínica', icon: '🩺' }, { v: 'Eventos', icon: '🎊' },
                          { v: 'Inmobiliaria', icon: '🏠' }, { v: 'Cafetería', icon: '☕' }, { v: 'Otro', icon: '✦' },
                        ].map(({ v, icon }) => (
                          <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, business_type: v }))} style={{
                            padding: '8px 10px',
                            background: form.business_type === v ? '#111827' : '#ffffff',
                            color: form.business_type === v ? '#ffffff' : '#6b7280',
                            border: 'none',
                            fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}>
                            <span style={{ fontSize: 12 }}>{icon}</span> {v}
                          </button>
                        ))}
                      </div>
                      {form.business_type === 'Otro' && (
                        <div style={{ padding: '8px 0', marginTop: 8 }}>
                          <input placeholder="¿Qué tipo de negocio tienes?" onChange={(e) => setForm((f) => ({ ...f, business_type: `Otro: ${e.target.value}` }))}
                            style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#111827', outline: 'none', background: 'none', boxSizing: 'border-box' }} />
                        </div>
                      )}
                    </div>
                    {/* Subject cards */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>¿En qué podemos ayudarte?</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {SUBJECTS.map((s) => (
                          <button key={s.value} type="button" onClick={() => setForm((f) => ({ ...f, subject: s.value }))}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                              background: form.subject === s.value ? '#f0fdf4' : '#ffffff',
                              borderTop: '1px solid #e5e7eb', borderBottom: 'none', borderLeft: form.subject === s.value ? '3px solid #0F766E' : '3px solid transparent', borderRight: 'none',
                              cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s', width: '100%',
                            }}>
                            <div>
                              <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.label}</span>
                              <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{s.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {form.subject === 'otro' && (
                        <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb' }}>
                          <input placeholder="Describe tu consulta..." onChange={(e) => setForm((f) => ({ ...f, subject: `otro: ${e.target.value}` }))}
                            style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#111827', outline: 'none', background: 'none', boxSizing: 'border-box' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'block', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Mensaje *</label>
                      <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Cuéntanos cómo podemos ayudarte..." required
                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #e5e7eb', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, color: '#111827', outline: 'none', background: 'none', minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
                        <input type="checkbox" checked={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.checked }))} style={{ accentColor: '#0F766E', width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                          Acepto la{' '}
                          <Link href="/legal/privacidad" style={{ color: '#0F766E', textDecoration: 'none' }}>política de privacidad</Link>
                          {' '}y el tratamiento de mis datos conforme al RGPD
                        </span>
                      </label>
                      <button type="submit" disabled={sending} style={{
                        width: '100%', padding: '13px 24px', background: '#111827', color: '#ffffff', border: 'none',
                        fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em', cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.5 : 1,
                      }}>
                        {sending ? 'Enviando...' : 'Enviar mensaje →'}
                      </button>
                      <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
                        Te respondemos en menos de 24h · Datos 100% seguros
                      </p>
                    </div>
                    {formError && (
                      <div style={{ padding: '10px 20px', background: '#fef2f2', borderTop: '1px solid #fca5a5', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, color: '#c62828' }}>
                        {formError}
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="cta-final">
        <div className="container">
          <h2>¿Listo para que llevemos<br />tus <em>redes</em>?</h2>
          <p className="cta-sub">Sin compromiso. Cancela cuando quieras.</p>
          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" onClick={() => router.push('/register')} style={{ padding: '16px 36px', fontSize: '1rem' }}>
              Empezar ahora →
            </button>
          </div>
          <p className="cta-guarantee">✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ GDPR compliant</p>
        </div>
      </section>

      <SiteFooter />

      <style jsx>{`
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
        }

        .contact-form-col {
          position: sticky;
          top: 24px;
        }

        .contact-social-links {
          display: flex;
          gap: 16px;
        }

        .contact-social-link {
          font-family: var(--font-barlow), 'Barlow', sans-serif;
          font-size: 12px;
          color: #0f766e;
          font-weight: 600;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr;
          }

          .contact-form-col {
            position: static;
          }
        }
      `}</style>
    </>
  );
}
