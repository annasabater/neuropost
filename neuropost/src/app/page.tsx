'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: '¿Necesito tener cuenta Business en Instagram?',
    a: 'Sí, necesitas una cuenta de Instagram Business o Creator (gratuita) para poder conectarla. El proceso de conversión tarda menos de 2 minutos y te explicamos paso a paso cómo hacerlo durante el onboarding.',
  },
  {
    q: '¿NeuroPost puede publicar sin que yo lo apruebe?',
    a: 'Sí, si activas el modo automático publicamos sin necesidad de aprobación. Pero también puedes elegir que te avisemos primero para revisar cada post antes de publicar. Puedes cambiar entre modos cuando quieras. Recomendamos empezar en modo supervisado hasta que confíes en los resultados.',
  },
  {
    q: '¿Cuántos créditos consume cada acción?',
    a: 'El plan Starter incluye 12 publicaciones al mes. Pro tiene publicaciones ilimitadas. Cada "publicación" incluye: análisis de foto, edición, caption, hashtags y programación. Las regeneraciones y el agente de comentarios tienen cuotas generosas documentadas en el panel.',
  },
  {
    q: '¿Puedo usarlo para TikTok?',
    a: 'Por ahora nos centramos en Instagram y Facebook, que es donde los negocios locales tienen más retorno. TikTok está en el roadmap para 2025. Si te interesa, apúntate a la lista de espera de TikTok desde tu panel.',
  },
  {
    q: '¿Mis fotos son privadas?',
    a: 'Tus fotos y datos de marca son 100% privados y no se usan para entrenar ningún modelo. Cumplimos con GDPR y puedes solicitar la eliminación total de tus datos en cualquier momento desde el panel de configuración.',
  },
  {
    q: '¿Qué pasa si cancelo? ¿Pierdo todo?',
    a: 'Al cancelar, mantienes acceso hasta el final del período pagado. Puedes exportar todo tu historial de contenido, métricas y brand kit en cualquier momento. Sin trampas ni letra pequeña.',
  },
];

const LOGOS = [
  '🍦 Heladería Toscana',
  '☕ Cafetería El Rincón',
  '🌮 Tacos & Co.',
  '💈 Barbería Retro',
  '🌸 Centro Estético Alma',
  '🍕 Pizzería Napoli',
  '👗 Boutique Mía',
  '🏋️ Gym Urban Fit',
];

const FEATURES = [
  { icon: '🎨', title: 'Preparamos tu contenido visual', desc: 'Elige el nivel: sin tocar, retoque suave o edición completa. Mejoramos colores, iluminación y composición de cada foto.' },
  { icon: '✍️', title: 'Captions y hashtags', desc: 'Texto creado con la voz de tu marca. Aprendemos tu tono y lo mantenemos en cada publicación.' },
  { icon: '📅', title: 'Calendario visual', desc: 'Vista mensual y semanal con drag & drop. Filtra por red, formato y estado. Siente el control total.' },
  { icon: '👁️', title: 'Preview real por red', desc: 'Ve exactamente cómo se verá en Instagram feed, reels y Facebook antes de aprobar. Sin sorpresas.' },
  { icon: '💬', title: 'Bandeja de comentarios', desc: 'Todos los comentarios de Instagram y Facebook en un solo lugar. Te sugerimos respuestas y tú apruebas.' },
  { icon: '📊', title: 'Métricas en lenguaje humano', desc: '"Tu mejor post fue el martes con foto de producto. Repítelo." No dashboards complejos, solo lo que importa.' },
  { icon: '💡', title: 'Ideas de contenido', desc: 'Pide "20 ideas para mi heladería en verano" y te preparamos un calendario completo listo para publicar.' },
  { icon: '🔔', title: 'Notificaciones inteligentes', desc: 'Post pendiente de aprobación, publicación fallida, comentario sin leer. Siempre al tanto sin estar pendiente.' },
  { icon: '⚙️', title: 'Modo automático o supervisado', desc: 'Tú decides: solo propuestas, tú apruebas antes de publicar, o nos encargamos de todo. Cambia cuando quieras.' },
];

const STEPS = [
  { n: '01', title: 'Cuéntanos tu negocio', desc: 'Responde 8 preguntas sobre tu negocio, sube tu logo y fotos. NeuroPost prepara tu perfil de marca.' },
  { n: '02', title: 'Conecta tus redes', desc: 'Conecta Instagram Business y Facebook Page con un clic. Proceso seguro via OAuth2.' },
  { n: '03', title: 'Sube tu contenido', desc: 'Fotos del día, del plato especial, del local. Nosotros editamos, escribimos y programamos.' },
  { n: '04', title: 'Aprueba y publica', desc: 'Revisa el preview real, aprueba con un clic o deja que lo publiquemos automáticamente.' },
];

const TESTIMONIALS = [
  { emoji: '🍦', quote: '"Antes tardaba 3 horas a la semana gestionando el Instagram de la heladería. Ahora subo las fotos y NeuroPost hace todo. El engagement ha subido un 280%."', name: 'María González', biz: 'Heladería Toscana, Barcelona' },
  { emoji: '☕', quote: '"Probé varias herramientas y ninguna entendía el tono de mi cafetería. NeuroPost aprendió nuestra forma de hablar en 2 días. Los clientes preguntan quién lleva el Instagram."', name: 'Carlos Martín', biz: 'Cafetería El Rincón, Madrid' },
  { emoji: '📱', quote: '"Gestiono 6 locales de mi cliente. Con NeuroPost tengo todo en un panel, el contenido adaptado a cada negocio. He triplicado lo que puedo cobrar por los mismos servicios."', name: 'Laura Jiménez', biz: 'Agencia LJ Social, Valencia' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [navShadow, setNavShadow] = useState(false);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const heroEmailRef = useRef<HTMLInputElement>(null);
  const ctaEmailRef  = useRef<HTMLInputElement>(null);

  // Nav scroll shadow
  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToRegister = useCallback((ref: React.RefObject<HTMLInputElement | null>) => {
    const email = ref.current?.value.trim() ?? '';
    if (!email) { ref.current?.focus(); return; }
    router.push(`/register?email=${encodeURIComponent(email)}`);
  }, [router]);

  return (
    <>
      {/* ─── NAV ─── */}
      <nav style={{ boxShadow: navShadow ? '0 4px 20px rgba(0,0,0,0.06)' : 'none' }}>
        <a href="#" className="nav-logo">
          <span className="logo-dot" />
          NeuroPost
        </a>
        <ul className="nav-links">
          <li><a href="#funciones">Funciones</a></li>
          <li><a href="#como-funciona">Cómo funciona</a></li>
          <li><a href="#precios">Precios</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><Link href="/about">Nosotros</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-eyebrow">
                <span />
                IA para negocios locales
              </div>
              <h1>Tu negocio en redes,<br /><em>sin preocuparte de nada</em></h1>
              <p className="hero-sub">
                Sube tus fotos, elige tu estilo y nosotros creamos, editamos y publicamos en Instagram y Facebook
                por ti. Sin agencias. Sin complicaciones.
              </p>
              <div className="hero-form">
                <input ref={heroEmailRef} type="email" placeholder="tu@email.com" onKeyDown={(e) => e.key === 'Enter' && goToRegister(heroEmailRef)} />
                <button className="btn-primary" onClick={() => goToRegister(heroEmailRef)}>
                  Prueba gratis 5 días →
                </button>
              </div>
              <div className="hero-trust">
                <div className="trust-avatars">
                  <span>🍦</span><span>☕</span><span>🌮</span><span>💈</span>
                </div>
                <span>+200 negocios ya automatizados</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="floating-badge badge-1"><span>✅</span> Post publicado en IG</div>
              <div className="mockup-card">
                <div className="mockup-header">
                  <div className="mockup-dots"><span /><span /><span /></div>
                  <span className="mockup-title">NeuroPost · Heladería Toscana</span>
                </div>
                <div className="mockup-body">
                  <div className="ai-message">
                    <div className="ai-label">✦ Preparando tu post</div>
                    <div className="ai-text">
                      Analizando tu foto... He detectado helado de pistacho con buena iluminación.
                      Generando caption con tono cercano y emoji moderado.
                    </div>
                  </div>
                  <div className="post-preview">
                    <div className="post-img" />
                    <div className="post-meta">
                      <div className="post-caption">El verano sabe a pistacho 🌿 Nuevo sabor disponible solo este fin de semana.</div>
                      <div className="post-tags">#heladeria #artesanal #barcelona</div>
                    </div>
                  </div>
                  <div className="mockup-actions">
                    <button className="action-btn action-approve">✓ Aprobar</button>
                    <button className="action-btn action-edit">✎ Editar</button>
                  </div>
                </div>
              </div>
              <div className="floating-badge badge-2"><span>📈</span> +340% engagement este mes</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LOGOS ─── */}
      <div className="logos-bar">
        <div className="logos-label">Negocios que ya confían en NeuroPost</div>
        <div className="logos-track">
          {[...LOGOS, ...LOGOS].map((name, i) => (
            <div key={i} className="logo-item">{name}</div>
          ))}
        </div>
      </div>

      {/* ─── FEATURES ─── */}
      <section className="features" id="funciones">
        <div className="container">
          <div className="section-eyebrow">Todo incluido</div>
          <h2>Una herramienta.<br />Todo lo que necesitas.</h2>
          <p className="section-sub">
            Desde subir la foto hasta analizar qué funcionó. Sin necesidad de diseñadores,
            community managers ni agencias.
          </p>
          <div className="features-grid fade-in">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="feature-card">
                <span className="feature-icon">{icon}</span>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="how" id="como-funciona">
        <div className="container">
          <div className="section-eyebrow" style={{ color: 'var(--text-tertiary)' }}>En 4 pasos</div>
          <h2 style={{ marginBottom: '12px' }}>De cero a publicar<br />en menos de 10 minutos</h2>
          <p className="section-sub" style={{ marginBottom: '60px' }}>Sin formación técnica, sin manual de instrucciones.</p>
          <div className="steps fade-in">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="step">
                <div className="step-num">{n}</div>
                <div className="step-title">{title}</div>
                <div className="step-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURE SHOWCASE ─── */}
      <section className="feature-showcase">
        <div className="container">

          {/* Analytics */}
          <div className="showcase-row fade-in">
            <div className="showcase-visual">
              <div className="visual-grid">
                <div className="vis-card">
                  <div className="vis-card-header">Engagement</div>
                  <div>
                    <div className="vis-bar"><div className="vis-bar-fill" style={{ width: '78%' }} /></div>
                    <div className="vis-bar"><div className="vis-bar-fill" style={{ width: '55%', background: 'var(--accent)', animationDelay: '0.2s' }} /></div>
                    <div className="vis-bar"><div className="vis-bar-fill" style={{ width: '91%', animationDelay: '0.4s' }} /></div>
                  </div>
                  <div className="vis-stat">+340%</div>
                  <div className="vis-stat-label">vs mes anterior</div>
                </div>
                <div className="vis-card">
                  <div className="vis-card-header">Mejor post</div>
                  <div className="vis-emoji">🍦</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '10px', color: 'var(--muted)' }}>
                    Martes 19h · Foto producto
                  </div>
                </div>
                <div className="vis-card" style={{ gridColumn: 'span 2' }}>
                  <div className="vis-card-header">Recomendación IA</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '11px', color: 'var(--ink)', lineHeight: '1.5' }}>
                    💡 &quot;Tus fotos de productos close-up generan 3× más engagement que las generales. Genera más esta semana.&quot;
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="showcase-label">Analytics</span>
              <h2 className="showcase-h">Métricas que<br />se explican solas</h2>
              <p className="showcase-p">
                No necesitas ser analista de datos. NeuroPost te dice en español qué está funcionando, qué no,
                y qué hacer exactamente para mejorar la semana siguiente.
              </p>
              <ul className="feature-list">
                <li>Informe mensual automático en PDF</li>
                <li>Mejor hora y formato por sector</li>
                <li>&quot;Qué repetir&quot; y &quot;qué dejar de hacer&quot;</li>
                <li>Top posts del mes con análisis de causa</li>
              </ul>
            </div>
          </div>

          {/* Brand Kit */}
          <div className="showcase-row reverse fade-in">
            <div>
              <span className="showcase-label">Brand Kit</span>
              <h2 className="showcase-h">NeuroPost aprende<br />tu estilo, para siempre</h2>
              <p className="showcase-p">
                Sube tu logo, colores, tipografía y ejemplos de posts que te gustan. Los memorizamos
                y los aplicamos en cada publicación. Nunca más contenido genérico.
              </p>
              <ul className="feature-list">
                <li>Paleta de colores y tipografías</li>
                <li>Tono de comunicación personalizado</li>
                <li>Slogans y CTAs favoritos</li>
                <li>Historial de posts que funcionaron</li>
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="visual-grid">
                <div className="vis-card">
                  <div className="vis-card-header">Tono de marca</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {[
                      { label: 'Cercano', bg: 'var(--accent-light)', color: 'var(--accent)' },
                      { label: 'Local', bg: 'var(--green-light)', color: 'var(--green)' },
                      { label: 'Artesanal', bg: 'var(--warm)', color: 'var(--muted)' },
                    ].map(({ label, bg, color }) => (
                      <span key={label} style={{ background: bg, color, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '9px', padding: '3px 8px', borderRadius: '0', fontWeight: 700 }}>{label}</span>
                    ))}
                  </div>
                </div>
                <div className="vis-card">
                  <div className="vis-card-header">Colores</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {['#0F766E', '#111111', '#E5E7EB'].map((c) => (
                      <div key={c} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c }} />
                    ))}
                  </div>
                </div>
                <div className="vis-card" style={{ gridColumn: 'span 2' }}>
                  <div className="vis-card-header">Hashtags favoritos</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '10px', color: 'var(--orange)', lineHeight: '1.8' }}>
                    #heladeria #artesanal #barcelona #helados #postres #verano
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="pricing" id="precios">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div className="section-eyebrow">Sin sorpresas</div>
            <h2>Precios claros.<br />Cancela cuando quieras.</h2>
            <p className="section-sub" style={{ margin: '12px auto 0', textAlign: 'center' }}>
              5 días de prueba gratuita en todos los planes.
            </p>
          </div>

          <div className="pricing-grid">
            <div className="plan">
              <div className="plan-name">Starter</div>
              <div className="plan-price"><sup>€</sup>29<span>/mes</span></div>
              <div className="plan-desc">Para negocios que empiezan en redes</div>
              <ul className="plan-features">
                {['1 cuenta (Instagram o Facebook)', '12 publicaciones al mes', 'Edición básica de fotos con IA', 'Captions y hashtags automáticos', 'Calendario de contenido', 'Aprobación manual'].map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/register" className="plan-btn">Empezar gratis →</Link>
            </div>

            <div className="plan featured">
              <div className="plan-badge">⚡ Más popular</div>
              <div className="plan-name">Pro</div>
              <div className="plan-price"><sup>€</sup>69<span>/mes</span></div>
              <div className="plan-desc">Para negocios activos que quieren crecer</div>
              <ul className="plan-features">
                {['Instagram + Facebook conectados', 'Publicaciones ilimitadas', 'Edición IA avanzada (colores, fondo)', 'Publicación automática programada', 'Bandeja de comentarios unificada', 'Informe mensual en PDF', 'Ideas de contenido por temporada', 'Brand Kit completo'].map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/register" className="plan-btn">Empezar gratis →</Link>
            </div>

            <div className="plan">
              <div className="plan-name">Agencia</div>
              <div className="plan-price"><sup>€</sup>199<span>/mes</span></div>
              <div className="plan-desc">Para agencias y negocios con varias sedes</div>
              <ul className="plan-features">
                {['Hasta 10 marcas / locales', 'Panel de gestión unificado', 'Todo lo de Pro por cada marca', 'Roles: admin, editor, aprobador', 'Informes por cliente', 'Soporte prioritario'].map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/register" className="plan-btn">Empezar gratis →</Link>
            </div>
          </div>

          <div className="pricing-note">
            🔒 Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="testimonials">
        <div className="container">
          <div className="section-eyebrow">Casos reales</div>
          <h2 style={{ marginBottom: '48px' }}>Lo que dicen<br />nuestros clientes</h2>
          <div className="testimonials-grid fade-in">
            {TESTIMONIALS.map(({ emoji, quote, name, biz }) => (
              <div key={name} className="testimonial">
                <div className="stars">★★★★★</div>
                <p className="testimonial-text">{quote}</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{emoji}</div>
                  <div>
                    <div className="author-name">{name}</div>
                    <div className="author-biz">{biz}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="faq" id="faq">
        <div className="container">
          <div className="faq-grid">
            <div className="faq-sidebar">
              <div className="section-eyebrow">FAQ</div>
              <h2>Preguntas frecuentes</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: '1.7', marginTop: '12px' }}>
                ¿Tienes más dudas? Escríbenos a{' '}
                <a href="mailto:hola@neuropost.es" style={{ color: 'var(--accent)' }}>hola@neuropost.es</a>
              </p>
            </div>
            <div className="faq-list">
              {FAQ_ITEMS.map(({ q, a }, i) => (
                <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                  <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
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

      {/* ─── CTA FINAL ─── */}
      <section className="cta-final">
        <div className="container">
          <h2>Tu competencia ya<br />tiene <em>a alguien que lleva sus redes</em></h2>
          <p className="cta-sub">Empieza hoy. 5 días de prueba gratuita.</p>
          <div className="cta-form">
            <input ref={ctaEmailRef} type="email" placeholder="tu@email.com" onKeyDown={(e) => e.key === 'Enter' && goToRegister(ctaEmailRef)} />
            <button className="btn-primary" onClick={() => goToRegister(ctaEmailRef)}>
              Crear cuenta gratis →
            </button>
          </div>
          <p className="cta-guarantee">✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin permanencia &nbsp;·&nbsp; ✓ GDPR compliant &nbsp;·&nbsp; ✓ 5 días gratis</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="nav-logo" style={{ color: '#F5F5F5' }}>
                <span className="logo-dot" />
                NeuroPost
              </a>
              <p>IA para que los negocios locales gestionen sus redes sociales sin esfuerzo. Hecho con ❤️ en España.</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📧 hola@neuropost.es</a>
                <a href="tel:+34900000000" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📞 +34 900 000 000</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Producto</div>
              <ul className="footer-links">
                <li><a href="#funciones">Funciones</a></li>
                <li><a href="#como-funciona">Cómo funciona</a></li>
                <li><a href="#precios">Precios</a></li>
                <li><Link href="/novedades">Novedades</Link></li>
                <li><Link href="/estado">Estado del servicio</Link></li>
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
    </>
  );
}
