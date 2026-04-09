'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

// ─── Unsplash helper ─────────────────────────────────────────────────────────
const UNS = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const HERO_POSTS = [
  { img: UNS('1565299624946-b28f40a0ae38'), caption: 'El mejor risotto de la ciudad 🍝 Reserva tu mesa para esta noche', likes: 234, sector: 'Restaurante' },
  { img: UNS('1563805042-7684c019e1cb'), caption: 'Pistacho artesanal recién hecho 🍦 El sabor del verano ya está aquí', likes: 189, sector: 'Heladería' },
  { img: UNS('1501339847302-ac426a4a7cbb'), caption: 'Empieza el día con el mejor café ☕ Latte art perfecto cada mañana', likes: 312, sector: 'Cafetería' },
  { img: UNS('1534438327276-14e5300c3a48'), caption: 'Sin excusas, solo resultados 💪 Clase de las 7am lista', likes: 156, sector: 'Gimnasio' },
  { img: UNS('1540555700478-4be289fbecef'), caption: 'Tu momento de relax te espera 💆 Reserva tu sesión', likes: 278, sector: 'Estética' },
  { img: UNS('1560518883-ce09059eeffa'), caption: 'Tu hogar soñado te espera 🏠 Ático con vistas espectaculares', likes: 145, sector: 'Inmobiliaria' },
];

const PORTFOLIO = [
  { img: UNS('1482049016688-2d3e1b311543'), caption: 'Mesa lista para esta noche ✨', hashtags: '#restaurante #gastronomia', sector: 'Restaurante' },
  { img: UNS('1570145820259-b5b80c5c8bd6'), caption: 'Nuevos sabores de temporada 🍦', hashtags: '#heladeria #artesanal', sector: 'Heladería' },
  { img: UNS('1495474472287-4d71bcdd2085'), caption: 'Tu rincón favorito te espera ☕', hashtags: '#cafeteria #brunch', sector: 'Cafetería' },
  { img: UNS('1571019614242-c5c5dee9f50b'), caption: 'Tu mejor versión empieza hoy 🔥', hashtags: '#gym #fitness', sector: 'Gimnasio' },
  { img: UNS('1503951914875-452162b0f3f1'), caption: 'Corte clásico, estilo eterno ✂️', hashtags: '#barberia #grooming', sector: 'Barbería' },
  { img: UNS('1441984904996-e0b6ba687e04'), caption: 'Nueva colección ya en tienda 🛍️', hashtags: '#boutique #moda', sector: 'Boutique' },
  { img: UNS('1570129477492-45c003edd2be'), caption: 'Cocina reformada con estilo ✨', hashtags: '#inmobiliaria #hogar', sector: 'Inmobiliaria' },
  { img: UNS('1490750967868-88aa4f44baee'), caption: 'Ramos que enamoran 🌺', hashtags: '#floristeria #flores', sector: 'Floristería' },
];

const SECTORS = [
  { label: 'Restaurantes', img: UNS('1517248135467-4c7edcad34c4', 400) },
  { label: 'Cafeterías', img: UNS('1501339847302-ac426a4a7cbb', 400) },
  { label: 'Gimnasios', img: UNS('1534438327276-14e5300c3a48', 400) },
  { label: 'Estética', img: UNS('1540555700478-4be289fbecef', 400) },
  { label: 'Inmobiliarias', img: UNS('1560518883-ce09059eeffa', 400) },
  { label: 'Tiendas', img: UNS('1441984904996-e0b6ba687e04', 400) },
];

const RESULTS = [
  { number: '+280%', label: 'Engagement medio', desc: 'en los primeros 3 meses' },
  { number: '+4h', label: 'Ahorro semanal', desc: 'de trabajo en redes sociales' },
  { number: '+200', label: 'Negocios activos', desc: 'ya confían en nosotros' },
];

const STEPS = [
  { n: '01', title: 'Cuéntanos tu negocio', desc: 'Responde unas preguntas sobre tu negocio y tu estilo. Preparamos tu perfil de marca.' },
  { n: '02', title: 'Conecta tus redes', desc: 'Vincula Instagram y Facebook con un clic. Proceso seguro y rápido.' },
  { n: '03', title: 'Nosotros creamos el contenido', desc: 'Cada semana preparamos posts profesionales con tus fotos. Editamos, escribimos y programamos.' },
  { n: '04', title: 'Tú apruebas, nosotros publicamos', desc: 'Revisa con un clic o déjanos publicar automáticamente según tu calendario.' },
];

type FaqCategory = { category: string; items: { q: string; a: string; highlight?: boolean }[] };
const FEATURED_FAQ = {
  q: '¿Tengo que crear el contenido yo?',
  a: 'No. Nos encargamos de todo: desde la idea hasta la publicación. Puedes elegir si prefieres que nuestro equipo lo gestione o si quieres crear contenido tú mismo desde la plataforma.',
};
const FAQ_DATA: FaqCategory[] = [
  { category: 'Uso del producto', items: [
    { q: '¿Puedo generar contenido yo mismo?', a: 'Sí. Puedes crear contenido directamente desde la plataforma utilizando nuestras herramientas. También puedes inspirarte en ideas y generar imágenes o vídeos a partir de ellas.' },
    { q: '¿Puedo usar mis propias fotos o vídeos?', a: 'Sí. Puedes subir tu contenido y nosotros lo utilizamos para crear publicaciones más profesionales y optimizadas.' },
  ]},
  { category: 'Contenido y gestión', items: [
    { q: '¿Tengo que aprobar el contenido?', a: 'Tú decides. Antes de publicar, puedes revisar y aprobar el contenido. Si lo prefieres, también podemos gestionarlo automáticamente.' },
    { q: '¿Cuánto tiempo tengo que dedicarle?', a: 'Muy poco o ninguno. Puedes delegarlo completamente en nuestro equipo o usar la plataforma cuando lo necesites.' },
    { q: '¿Qué pasa si quiero cambios?', a: 'Puedes pedir modificaciones en cualquier momento. El objetivo es que el contenido encaje perfectamente con tu negocio.' },
  ]},
  { category: 'Plataforma', items: [
    { q: '¿Qué tipo de negocios pueden usar NeuroPost?', a: 'Trabajamos con negocios locales como restaurantes, gimnasios, centros de estética, inmobiliarias y más. Cualquier negocio que quiera mejorar su presencia en redes.' },
    { q: '¿En qué redes sociales publicáis?', a: 'Actualmente nos centramos en Instagram y Facebook, donde los negocios locales obtienen mejores resultados. Estamos trabajando para ampliar a otras plataformas.' },
    { q: '¿Se puede generar contenido con IA?', a: 'Sí. Puedes generar contenido tú mismo desde la plataforma o solicitarlo a nuestro equipo para que lo prepare por ti. Nos adaptamos a cómo prefieras trabajar.' },
  ]},
  { category: 'Planes y condiciones', items: [
    { q: '¿Mis fotos y contenido son privados?', a: 'Sí. Todo tu contenido es privado y solo tú tienes acceso. Cumplimos con GDPR.' },
    { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Puedes cancelar en cualquier momento sin permanencias. Sin trampas ni letra pequeña.' },
  ]},
];

const TESTIMONIALS = [
  { name: 'María González', biz: 'Heladería Toscana, Barcelona', quote: 'Antes tardaba 3 horas semanales en Instagram. Ahora subo las fotos y el equipo se encarga de todo. El engagement ha subido un 280%.' },
  { name: 'Carlos Martín', biz: 'Cafetería El Rincón, Madrid', quote: 'Nadie nota que no soy yo quien escribe los posts. Han aprendido exactamente cómo habla mi marca. Los clientes preguntan quién lleva el Instagram.' },
  { name: 'Laura Jiménez', biz: 'Agencia LJ Social, Valencia', quote: 'Gestiono 6 locales. Con NeuroPost tengo un equipo para cada uno. He triplicado lo que puedo cobrar por los mismos servicios.' },
];

const LOGOS = ['🍦 Heladería Toscana', '☕ Cafetería El Rincón', '🌮 Tacos & Co.', '💈 Barbería Retro', '🌸 Centro Estético Alma', '🍕 Pizzería Napoli', '👗 Boutique Mía', '🏋️ Gym Urban Fit'];

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [navShadow, setNavShadow] = useState(false);
  const [activeFaqCategory, setActiveFaqCategory] = useState(0);
  const [activeFaqQuestion, setActiveFaqQuestion] = useState<number | null>(0);
  const heroEmailRef = useRef<HTMLInputElement>(null);
  const ctaEmailRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
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
      <nav style={{ boxShadow: navShadow ? '0 1px 0 #e5e7eb' : 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <a href="#" className="nav-logo">NeuroPost</a>
        <ul className="nav-links">
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="#funciones" style={{ cursor: 'pointer' }}>Producto</a>
            <div data-drop style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', minWidth: 180, zIndex: 100, padding: '8px 0' }}>
              <a href="#funciones" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Portfolio</a>
              <a href="#sectores" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Sectores</a>
              <a href="#como-funciona" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Cómo funciona</a>
            </div>
          </li>
          <li><a href="#resultados">Resultados</a></li>
          <li><a href="#precios">Precios</a></li>
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="#testimonios" style={{ cursor: 'pointer' }}>Empresa</a>
            <div data-drop style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', minWidth: 180, zIndex: 100, padding: '8px 0' }}>
              <Link href="/about" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Sobre nosotros</Link>
              <Link href="/about#valores" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Valores</Link>
              <Link href="/about#equipo" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Equipo</Link>
              <Link href="/about#contacto" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Contacto</Link>
              <a href="#testimonios" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Clientes</a>
              <a href="#faq" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>FAQ</a>
              <Link href="/novedades" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Novedades</Link>
            </div>
          </li>
          <li><LanguageSelector /></li>
          <li><Link href="/login" className="nav-login">Entrar</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ padding: '140px 0 80px', background: '#ffffff' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 800 }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 20 }}>
            Tu equipo de redes sociales
          </div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.8rem, 6vw, 4.5rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, color: '#111111', marginBottom: 24 }}>
            Nos encargamos de <span style={{ color: '#0F766E' }}>tus redes</span> para que tú te encargues de tu negocio
          </h1>
          <p style={{ fontFamily: f, fontSize: 17, color: '#6b7280', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 32px' }}>
            Creamos contenido que hace que la gente te vea, te recuerde y termine entrando por la puerta.
          </p>
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', maxWidth: 420, margin: '0 auto 16px' }}>
            <input ref={heroEmailRef} type="email" placeholder="tu@email.com" onKeyDown={(e) => e.key === 'Enter' && goToRegister(heroEmailRef)}
              style={{ flex: 1, padding: '14px 18px', border: '1px solid #e5e7eb', borderRight: 'none', fontFamily: f, fontSize: 15, outline: 'none', color: '#111111' }} />
            <button onClick={() => goToRegister(heroEmailRef)}
              style={{ padding: '14px 28px', background: '#0F766E', color: '#ffffff', border: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Empezar gratis →
            </button>
          </div>
          <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>5 días gratis · Cancela cuando quieras</p>
        </div>

        {/* Hero carousel — auto-scrolling posts */}
        <div style={{ marginTop: 60, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 2, animation: 'scroll-landing 30s linear infinite', width: 'max-content' }}>
            {[...HERO_POSTS, ...HERO_POSTS].map((post, i) => (
              <div key={i} style={{ width: 280, flexShrink: 0, background: '#ffffff', border: '1px solid #e5e7eb' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.img} alt="" style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontFamily: f, fontSize: 13, color: '#111111', lineHeight: 1.5, marginBottom: 6 }}>{post.caption}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>♥ {post.likes}</span>
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>{post.sector}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes scroll-landing { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </section>

      {/* ─── LOGOS ─── */}
      <div className="logos-bar">
        <div className="logos-label">Negocios que ya confían en NeuroPost</div>
        <div className="logos-track">
          {[...LOGOS, ...LOGOS].map((name, i) => <div key={i} className="logo-item">{name}</div>)}
        </div>
      </div>

      {/* ─── RESULTADOS — scroll horitzontal ─── */}
      <section id="resultados" style={{ padding: '80px 0', background: '#111111' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>Resultados reales</div>
              <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 0.95 }}>
                Porque lo que no se ve,<br />no se vende
              </h2>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', paddingLeft: 'max(20px, calc((100vw - 1160px) / 2 + 20px))' }}>
          {RESULTS.map(({ number, label, desc }) => (
            <div key={label} style={{ flex: '0 0 320px', scrollSnapAlign: 'start', background: '#1a1a1a', padding: '40px 32px', borderRight: '1px solid #333' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '4rem', letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1 }}>{number}</p>
              <p style={{ fontFamily: f, fontSize: 14, fontWeight: 600, color: '#ffffff', marginTop: 12 }}>{label}</p>
              <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── LO QUE PUBLICAMOS POR TI ─── */}
      <section id="funciones" style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>Portfolio</div>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
              Lo que publicamos por ti
            </h2>
            <p style={{ fontFamily: f, fontSize: 15, color: '#6b7280', marginTop: 12 }}>Contenido real para negocios como el tuyo</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb' }} className="fade-in portfolio-grid">
            {PORTFOLIO.map((p, i) => (
              <div key={i} style={{ background: '#ffffff' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontFamily: f, fontSize: 11, color: '#111111', lineHeight: 1.4, marginBottom: 2 }}>{p.caption}</p>
                  <p style={{ fontFamily: f, fontSize: 9, color: '#9ca3af' }}>{p.hashtags}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTORES — scroll horitzontal ─── */}
      <section id="sectores" style={{ padding: '80px 0', background: '#f5f5f5' }}>
        <div className="container" style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
            Funciona para cualquier negocio local
          </h2>
        </div>
        <div className="container fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
          {SECTORS.map(({ label, img }) => (
            <div key={label} style={{ position: 'relative', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={label} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.75))' }} />
              <p style={{ position: 'absolute', bottom: 16, left: 16, fontFamily: fc, fontSize: 16, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA — scroll horitzontal ─── */}
      <section id="como-funciona" style={{ padding: '80px 0' }}>
        <div className="container" style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>En 4 pasos</div>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
            De cero a publicar<br />en menos de 10 minutos
          </h2>
        </div>
        <div className="fade-in" style={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', paddingLeft: 'max(20px, calc((100vw - 1160px) / 2 + 20px))' }}>
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} style={{ flex: '0 0 300px', scrollSnapAlign: 'start', background: '#ffffff', border: '1px solid #e5e7eb', borderRight: 'none', padding: '32px 28px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '3rem', color: '#e5e7eb', lineHeight: 1, marginBottom: 16 }}>{n}</p>
              <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 16, textTransform: 'uppercase', color: '#111111', marginBottom: 8 }}>{title}</p>
              <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING — scroll horitzontal ─── */}
      <section className="pricing" id="precios" style={{ padding: '80px 0', background: '#f5f5f5' }}>
        <div className="container" style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>Precios claros</div>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
            Sin sorpresas. Cancela cuando quieras.
          </h2>
          <p style={{ fontFamily: f, fontSize: 15, color: '#6b7280', marginTop: 12 }}>5 días de prueba gratuita en todos los planes.</p>
        </div>
        <div style={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', paddingLeft: 'max(20px, calc((100vw - 1160px) / 2 + 20px))', paddingBottom: 4 }}>
          {[
            { name: 'Starter', price: '29', desc: 'Para negocios que empiezan en redes', features: ['1 cuenta (Instagram o Facebook)', '12 publicaciones al mes', 'Edición de fotos', 'Captions y hashtags', 'Calendario de contenido', 'Aprobación manual'] },
            { name: 'Pro', price: '69', desc: 'Para negocios activos que quieren crecer', featured: true, features: ['Instagram + Facebook', 'Publicaciones ilimitadas', 'Edición avanzada', 'Publicación automática', 'Bandeja de comentarios', 'Informe mensual', 'Ideas de contenido', 'Brand Kit completo'] },
            { name: 'Agencia', price: '199', desc: 'Para agencias y negocios con varias sedes', features: ['Hasta 10 marcas', 'Panel de gestión unificado', 'Todo lo de Pro por marca', 'Roles y permisos', 'Informes por cliente', 'Soporte prioritario'] },
          ].map(({ name, price, desc, featured, features }) => (
            <div key={name} style={{ flex: '0 0 340px', scrollSnapAlign: 'start', background: featured ? '#111111' : '#ffffff', border: featured ? 'none' : '1px solid #e5e7eb', padding: '40px 32px', display: 'flex', flexDirection: 'column' }}>
              {featured && <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0F766E', background: '#f0fdf4', padding: '3px 10px', alignSelf: 'flex-start', marginBottom: 16 }}>Más popular</span>}
              <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: featured ? '#ffffff' : '#111111', marginBottom: 4 }}>{name}</p>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '3rem', color: featured ? '#ffffff' : '#111111', lineHeight: 1, marginBottom: 4 }}>
                <span style={{ fontSize: 18, verticalAlign: 'top' }}>€</span>{price}<span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af' }}>/mes</span>
              </p>
              <p style={{ fontFamily: f, fontSize: 13, color: featured ? '#9ca3af' : '#6b7280', marginBottom: 24 }}>{desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {features.map((feat) => (
                  <li key={feat} style={{ fontFamily: f, fontSize: 13, color: featured ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#0F766E', fontSize: 12 }}>✓</span> {feat}
                  </li>
                ))}
              </ul>
              <Link href="/register" style={{
                display: 'block', textAlign: 'center', padding: '14px 24px', textDecoration: 'none',
                background: featured ? '#ffffff' : '#111111', color: featured ? '#111111' : '#ffffff',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Empezar gratis →
              </Link>
            </div>
          ))}
        </div>
        <div className="container">
          <p style={{ fontFamily: f, textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia</p>
        </div>
      </section>

      {/* ─── TESTIMONIALS — scroll horitzontal ─── */}
      <section id="testimonios" style={{ padding: '80px 0' }}>
        <div className="container" style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>Casos reales</div>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
            Lo que dicen nuestros clientes
          </h2>
        </div>
        <div className="fade-in" style={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', paddingLeft: 'max(20px, calc((100vw - 1160px) / 2 + 20px))' }}>
          {TESTIMONIALS.map(({ name, biz, quote }) => (
            <div key={name} style={{ flex: '0 0 380px', scrollSnapAlign: 'start', background: '#ffffff', border: '1px solid #e5e7eb', padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: f, fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 24, fontStyle: 'italic' }}>&ldquo;{quote}&rdquo;</p>
              <div>
                <p style={{ fontFamily: f, fontSize: 13, fontWeight: 700, color: '#111111' }}>{name}</p>
                <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>{biz}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" style={{ padding: '90px 0', background: 'linear-gradient(180deg, #fcfcfb 0%, #f4f7f7 100%)' }}>
        <div className="container">
          {(() => {
            const categoryNames = FAQ_DATA.map((cat) => cat.category === 'Planes y condiciones' ? 'Planes' : cat.category);
            const categoryIcons = ['◎', '◇', '◍', '▣'];
            const featured = FEATURED_FAQ;
            const activeCategory = FAQ_DATA[activeFaqCategory] ?? FAQ_DATA[0];
            const activeItems = activeCategory.items;
            const selectedQuestion =
              activeFaqQuestion !== null
                ? Math.min(activeFaqQuestion, Math.max(activeItems.length - 1, 0))
                : null;

            return (
              <>
                <div style={{ marginBottom: 42 }}>
                  <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>FAQ</div>
                  <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95, marginBottom: 12 }}>
                    Respuestas sin rodeos,
                    <br />
                    con foco en tu negocio
                  </h2>
                  <p style={{ fontFamily: f, color: '#6b7280', fontSize: 15, lineHeight: 1.7, maxWidth: 620 }}>
                    Explora por temas y abre solo lo que te interesa. Diseñado como un panel interactivo, no como un acordeón clásico.
                  </p>
                </div>

                {/* Featured answer */}
                <div style={{
                  marginBottom: 34,
                  padding: '24px 28px',
                  borderTop: '2px solid #0F766E',
                  borderBottom: '1px solid #dce7e6',
                  background: 'linear-gradient(90deg, rgba(15,118,110,0.08) 0%, rgba(15,118,110,0.02) 58%, rgba(15,118,110,0) 100%)',
                }}>
                  <div style={{
                    fontFamily: f,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: '#0F766E',
                    marginBottom: 10,
                  }}>
                    Respuesta rapida
                  </div>
                  <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, color: '#111111', marginBottom: 8 }}>
                    {featured.q}
                  </p>
                  <p style={{ fontFamily: f, fontSize: 14, lineHeight: 1.75, color: '#374151', maxWidth: 800, margin: 0 }}>
                    {featured.a}
                  </p>
                </div>

                {/* Interactive panel */}
                <div className="faq-knowledge-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 34%) minmax(0, 66%)', gap: 36, alignItems: 'start' }}>
                  {/* LEFT: categories */}
                  <div style={{ paddingRight: 8 }}>
                    <div style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 12 }}>
                      Categorias
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #e5e7eb' }}>
                      {categoryNames.map((name, idx) => {
                        const active = idx === activeFaqCategory;
                        return (
                          <button
                            key={name}
                            onClick={() => { setActiveFaqCategory(idx); setActiveFaqQuestion(null); }}
                            className="faq-cat-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '14px 0',
                              background: 'none',
                              border: 'none',
                              borderBottom: '1px solid #e5e7eb',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: active ? '#0F766E' : '#6b7280',
                              transition: 'color 0.18s ease',
                            }}
                          >
                            <span style={{ fontFamily: f, fontSize: 14, fontWeight: active ? 700 : 500 }}>{name}</span>
                            <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: active ? '#0F766E' : '#9ca3af' }}>{categoryIcons[idx] ?? '•'}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginTop: 14, lineHeight: 1.6 }}>
                      ¿No encuentras tu caso?
                      <br />
                      <a href="mailto:hola@neuropost.es" style={{ color: '#0F766E', textDecoration: 'none', fontWeight: 600 }}>hola@neuropost.es →</a>
                    </p>
                  </div>

                  {/* RIGHT: question explorer */}
                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 14 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 20,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af' }}>
                        {categoryNames[activeFaqCategory]}
                      </div>
                      <div style={{ fontFamily: f, fontSize: 11, color: '#6b7280' }}>
                        {selectedQuestion !== null ? `${selectedQuestion + 1}/${activeItems.length}` : `0/${activeItems.length}`}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                      {activeItems.map((item, idx) => {
                        const isOpen = idx === selectedQuestion;
                        return (
                          <div
                            key={item.q}
                            style={{
                              borderBottom: '1px solid #e5e7eb',
                              paddingBottom: 8,
                              opacity: isOpen ? 1 : 0.45,
                              transition: 'opacity 0.18s ease',
                            }}
                          >
                            <button
                              onClick={() => setActiveFaqQuestion(isOpen ? null : idx)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                padding: '8px 0',
                              }}
                            >
                              <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 20, lineHeight: 1.1, color: '#111111' }}>
                                {item.q}
                              </span>
                              <span style={{
                                width: 26,
                                height: 26,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: f,
                                fontSize: 11,
                                fontWeight: 700,
                                color: isOpen ? '#ffffff' : '#6b7280',
                                background: isOpen ? '#0F766E' : '#eef2f2',
                                transition: 'all 0.18s ease',
                              }}>
                                {isOpen ? '−' : '+'}
                              </span>
                            </button>

                            <div style={{
                              maxHeight: isOpen ? 220 : 0,
                              opacity: isOpen ? 1 : 0,
                              transform: isOpen ? 'translateY(0px)' : 'translateY(8px)',
                              transition: 'max-height 0.2s ease, opacity 0.18s ease, transform 0.18s ease',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                marginTop: 8,
                                marginLeft: 20,
                                padding: '12px 14px',
                                background: 'rgba(15, 118, 110, 0.06)',
                                borderLeft: '2px solid #0F766E',
                              }}>
                                <div style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0F766E', marginBottom: 8 }}>
                                  Respuesta rapida
                                </div>
                                <p style={{ fontFamily: f, fontSize: 14, lineHeight: 1.7, color: '#374151', margin: 0 }}>
                                  {item.a}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <style>{`
                  .faq-cat-item:hover {
                    color: #0F766E !important;
                  }
                  @media (max-width: 920px) {
                    .faq-knowledge-grid {
                      grid-template-columns: 1fr !important;
                      gap: 24px !important;
                    }
                  }
                `}</style>
              </>
            );
          })()}
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section style={{ padding: '80px 0', background: '#111111' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 0.95, marginBottom: 12 }}>
            Tu competencia ya tiene<br />a alguien que <span style={{ color: '#0F766E' }}>lleva sus redes</span>
          </h2>
          <p style={{ fontFamily: f, fontSize: 15, color: '#9ca3af', marginBottom: 32 }}>Empieza hoy. 5 días de prueba gratuita.</p>
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', maxWidth: 420, margin: '0 auto 16px' }}>
            <input ref={ctaEmailRef} type="email" placeholder="tu@email.com" onKeyDown={(e) => e.key === 'Enter' && goToRegister(ctaEmailRef)}
              style={{ flex: 1, padding: '14px 18px', border: '1px solid #333333', background: '#1a1a1a', color: '#ffffff', fontFamily: f, fontSize: 15, outline: 'none' }} />
            <button onClick={() => goToRegister(ctaEmailRef)}
              style={{ padding: '14px 28px', background: '#ffffff', color: '#111111', border: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Crear cuenta gratis
            </button>
          </div>
          <p style={{ fontFamily: f, fontSize: 11, color: '#6b7280' }}>✓ Cancela cuando quieras · ✓ Sin permanencia · ✓ GDPR · ✓ 5 días gratis</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="nav-logo" style={{ color: '#f5f5f5' }}>NeuroPost</a>
              <p>El equipo que gestiona las redes de tu negocio local. Hecho con cariño en España.</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', fontFamily: f }}>hola@neuropost.es</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Producto</div>
              <ul className="footer-links">
                <li><a href="#resultados">Resultados</a></li>
                <li><a href="#como-funciona">Cómo funciona</a></li>
                <li><a href="#precios">Precios</a></li>
                <li><Link href="/novedades">Novedades</Link></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Empresa</div>
              <ul className="footer-links">
                <li><Link href="/about">Sobre nosotros</Link></li>
                <li><Link href="/about#contacto">Contacto</Link></li>
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
