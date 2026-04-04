'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
    <div className="fade-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: 'white', flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>{name}</div>
          <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: 'var(--orange)', fontWeight: 600 }}>{role}</div>
        </div>
      </div>
      <p style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>&ldquo;{quote}&rdquo;</p>
    </div>
  );
}

// ─── Value card ───────────────────────────────────────────────────────────────

function ValueCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="fade-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>
      <div style={{ fontSize: '2rem', marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '1.15rem', color: 'var(--ink)', marginBottom: 10 }}>{title}</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ─── Contact info card ────────────────────────────────────────────────────────

function ContactCard({ icon, title, value, sub, href }: { icon: string; title: string; value: string; sub?: string; href: string }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.2s, transform 0.2s' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--orange)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}>
      <span style={{ fontSize: '1.3rem', marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{title}</div>
        <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, color: 'var(--ink)', fontSize: '0.95rem' }}>{value}</div>
        {sub && <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BUSINESS_TYPES = ['Heladería', 'Restaurante', 'Cafetería', 'Gym', 'Clínica', 'Barbería', 'Boutique', 'Otro'];
const SUBJECTS       = ['Quiero una demo', 'Tengo una pregunta', 'Problema técnico', 'Quiero ser afiliado', 'Otro'];

export default function AboutPage() {
  const router = useRouter();
  const [navShadow, setNavShadow]     = useState(false);
  const [statsActive, setStatsActive] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Contact form state
  const [form, setForm]       = useState({ name: '', email: '', business_type: '', subject: '', message: '', privacy: false });
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
      <nav style={{ boxShadow: navShadow ? '0 4px 20px rgba(0,0,0,0.06)' : 'none' }}>
        <a href="/" className="nav-logo">
          <span className="logo-dot" />
          NeuroPost
        </a>
        <ul className="nav-links">
          <li><a href="/#funciones">Funciones</a></li>
          <li><a href="/#como-funciona">Cómo funciona</a></li>
          <li><a href="/#precios">Precios</a></li>
          <li><Link href="/about" style={{ color: 'var(--ink)', fontWeight: 700 }}>Nosotros</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ background: 'var(--ink)', paddingTop: 120, paddingBottom: 96, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 80% 50%, rgba(255,92,26,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 20%, rgba(255,92,26,0.06) 0%, transparent 60%)' }} />
        <div className="container" style={{ position: 'relative', textAlign: 'center', maxWidth: 720 }}>
          <div className="hero-eyebrow" style={{ background: 'rgba(255,92,26,0.15)', border: '1px solid rgba(255,92,26,0.3)', color: 'rgba(255,92,26,0.9)', margin: '0 auto 32px', display: 'inline-flex' }}>
            <span />
            Sobre nosotros
          </div>
          <h1 style={{ color: 'white', marginBottom: 24 }}>
            Somos el equipo que lleva<br />las redes de <em>tu negocio</em>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            Nacimos en Barcelona con una idea simple: los dueños de negocios locales no deberían perder
            horas gestionando Instagram. Nosotros nos encargamos.
          </p>
        </div>
      </section>

      {/* ─── HISTORIA ─── */}
      <section style={{ background: 'var(--cream)', padding: '96px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 72, alignItems: 'center' }}>
            <div className="fade-in">
              <div className="section-eyebrow">Nuestra historia</div>
              <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 28, lineHeight: 1.1 }}>
                Por qué creamos NeuroPost
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  'Todo empezó cuando vimos cómo el dueño de una heladería en el Eixample cerraba el local a las 10 de la noche y todavía tenía que sacar el móvil para publicar en Instagram. Llevaba así tres años.',
                  'Sabíamos que la tecnología podía resolver eso. Creamos NeuroPost para que cualquier negocio local, sin importar su tamaño ni sus conocimientos digitales, pudiera tener una presencia profesional en redes sin dedicarle tiempo.',
                  'Hoy ayudamos a más de 200 negocios en toda España a publicar mejor, más rápido y con mejores resultados. Y acabamos de empezar.',
                ].map((p, i) => (
                  <p key={i} style={{ color: i === 2 ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.75, fontSize: '0.97rem', fontWeight: i === 2 ? 600 : 400 }}>{p}</p>
                ))}
              </div>
            </div>

            {/* Stats card */}
            <div ref={statsRef} className="fade-in">
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.07)' }}>
                <div style={{ background: 'var(--ink)', padding: '20px 28px' }}>
                  <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>NeuroPost en números</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  {STATS.map((stat, i) => (
                    <div key={i} style={{ borderTop: i >= 2 ? `1px solid var(--border)` : undefined, borderLeft: i % 2 !== 0 ? `1px solid var(--border)` : undefined }}>
                      <StatCard stat={stat} active={statsActive} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VALORES ─── */}
      <section style={{ background: 'var(--warm)', padding: '96px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-eyebrow">Lo que nos guía</div>
            <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1.1 }}>
              Nuestros valores
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            <ValueCard icon="✦" title="Simplicidad" desc="Creemos que la tecnología debe simplificar la vida, no complicarla. Si algo no es fácil de usar, lo rediseñamos hasta que lo sea." />
            <ValueCard icon="📈" title="Resultados reales" desc="No medimos el éxito en funcionalidades. Lo medimos en clientes que venden más, en negocios que crecen y en dueños que recuperan su tiempo." />
            <ValueCard icon="🤝" title="Transparencia" desc="Sin contratos largos, sin letra pequeña, sin sorpresas en la factura. Precio claro, resultado claro, cancela cuando quieras." />
          </div>
        </div>
      </section>

      {/* ─── EQUIPO ─── */}
      <section style={{ background: 'var(--cream)', padding: '96px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-eyebrow">El equipo</div>
            <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1.1 }}>
              Las personas detrás de NeuroPost
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, marginBottom: 48 }}>
            <TeamCard initials="AC" name="[Nombre del CEO]" role="Co-fundador & CEO" quote="Obsesionado con hacer que las cosas funcionen de verdad." />
            <TeamCard initials="MS" name="[Nombre del CTO]" role="Co-fundador & CTO" quote="Si no está automatizado, no está terminado." />
            <TeamCard initials="LR" name="[Nombre de Diseño]" role="Diseño de producto" quote="El diseño es la primera capa de confianza." />
            <TeamCard initials="JM" name="[Nombre de Crecimiento]" role="Growth & Clientes" quote="Cada negocio tiene su historia. Me encargo de contarla." />
          </div>
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", color: 'var(--muted)', marginBottom: 8 }}>¿Quieres formar parte del equipo?</p>
            <a href="mailto:jobs@neuropost.es" style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, color: 'var(--orange)', textDecoration: 'none', fontSize: '0.95rem' }}>
              jobs@neuropost.es →
            </a>
          </div>
        </div>
      </section>

      {/* ─── CONTACTO ─── */}
      <section id="contacto" style={{ background: 'var(--surface)', padding: '96px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 64 }}>

            {/* Left: info */}
            <div className="fade-in">
              <div className="section-eyebrow">Contacto</div>
              <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 16, lineHeight: 1.1 }}>
                Hablemos
              </h2>
              <p style={{ color: 'var(--muted)', lineHeight: 1.75, marginBottom: 32, fontSize: '0.97rem' }}>
                ¿Tienes alguna pregunta? ¿Quieres ver una demo? Escríbenos y te respondemos en menos de 24 horas.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                <ContactCard icon="📧" title="Email general" value="hola@neuropost.es" href="mailto:hola@neuropost.es" />
                <ContactCard icon="📞" title="Teléfono" value="+34 XXX XXX XXX" sub="Lunes a viernes, 9:00 - 18:00" href="tel:+34XXXXXXXXX" />
                <ContactCard icon="📍" title="Dirección" value="Barcelona, España" href="https://maps.google.com/?q=Barcelona" />
              </div>

              <div style={{ background: 'var(--warm)', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
                <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink)', marginBottom: 10 }}>Horario de atención</div>
                {[['Lunes - Viernes', '9:00 - 18:00'], ['Sábados', '10:00 - 14:00'], ['Domingos', 'Cerrado']].map(([d, h]) => (
                  <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.88rem', color: 'var(--muted)', padding: '4px 0' }}>
                    <span>{d}</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{h}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <a href="https://instagram.com/neuropost_es" target="_blank" rel="noreferrer" style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }}>
                  📷 @neuropost_es
                </a>
                <a href="https://linkedin.com/company/neuropost" target="_blank" rel="noreferrer" style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }}>
                  💼 LinkedIn
                </a>
              </div>
            </div>

            {/* Right: form */}
            <div className="fade-in">
              <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px 32px' }}>
                {sent ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                    <h3 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--ink)', marginBottom: 10 }}>¡Mensaje enviado!</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Te escribimos pronto. Normalmente respondemos en menos de 24 horas.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Nombre completo *</label>
                        <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tu nombre" required
                          onFocus={(e) => (e.target.style.borderColor = 'var(--orange)')} onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email *</label>
                        <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="tu@email.com" required
                          onFocus={(e) => (e.target.style.borderColor = 'var(--orange)')} onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Tipo de negocio</label>
                        <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.business_type} onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--orange)')} onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}>
                          <option value="">Seleccionar</option>
                          {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Asunto</label>
                        <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--orange)')} onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}>
                          <option value="">Seleccionar</option>
                          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Mensaje *</label>
                      <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Cuéntanos cómo podemos ayudarte..." required
                        onFocus={(e) => (e.target.style.borderColor = 'var(--orange)')} onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.checked }))} style={{ marginTop: 3, accentColor: 'var(--orange)', width: 16, height: 16, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                        Acepto la <Link href="/privacidad" style={{ color: 'var(--orange)', textDecoration: 'none' }}>política de privacidad</Link>
                      </span>
                    </label>
                    {formError && (
                      <div style={{ background: '#fff0eb', border: '1px solid rgba(255,92,26,0.3)', borderRadius: 8, padding: '10px 14px', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--orange)' }}>
                        {formError}
                      </div>
                    )}
                    <button type="submit" disabled={sending} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: sending ? 0.7 : 1 }}>
                      {sending ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Enviando...
                        </>
                      ) : 'Enviar mensaje →'}
                    </button>
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
          <p className="cta-sub">14 días gratis. Sin tarjeta de crédito.</p>
          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" onClick={() => router.push('/register')} style={{ padding: '16px 36px', fontSize: '1rem' }}>
              Empezar ahora →
            </button>
          </div>
          <p className="cta-guarantee">✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin permanencia &nbsp;·&nbsp; ✓ GDPR compliant</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="/" className="nav-logo" style={{ color: 'var(--cream)' }}>
                <span className="logo-dot" />
                NeuroPost
              </a>
              <p>IA para que los negocios locales gestionen sus redes sociales sin esfuerzo. Hecho con ❤️ en España.</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📧 hola@neuropost.es</a>
                <a href="tel:+34XXXXXXXXX" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📞 +34 XXX XXX XXX</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Producto</div>
              <ul className="footer-links">
                <li><a href="/#funciones">Funciones</a></li>
                <li><a href="/#como-funciona">Cómo funciona</a></li>
                <li><a href="/#precios">Precios</a></li>
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
                <li><a href="#">Privacidad</a></li>
                <li><a href="#">Términos</a></li>
                <li><a href="#">Cookies</a></li>
                <li><a href="#">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 NeuroPost · Todos los derechos reservados</span>
            <span>Hecho en Barcelona 🇪🇸</span>
          </div>
        </div>
      </footer>
    </>
  );
}
