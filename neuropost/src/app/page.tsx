'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { SiteFooter } from '@/components/layout/SiteFooter';

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
  { img: '/floristeria-ramos.jpg', caption: 'Ramos que enamoran 🌹', hashtags: '#floristería #flores', sector: 'Floristería' },
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

const DEMO_VIDEOS = [
  {
    title: 'Vista general del dashboard',
    desc: 'Panel principal, calendario y estado de publicaciones en un vistazo.',
    src: 'https://cdn.coverr.co/videos/coverr-working-on-a-laptop-in-an-office-1576/1080p.mp4',
    poster: UNS('1516321318423-f06f85e504b3'),
  },
  {
    title: 'Flujo de creación de posts',
    desc: 'Cómo preparar, revisar y dejar programado contenido en minutos.',
    src: 'https://cdn.coverr.co/videos/coverr-typing-on-a-laptop-1575/1080p.mp4',
    poster: UNS('1483058712412-4245e9b90334'),
  },
];

const DEMO_PHOTOS = [
  {
    title: 'Calendario editorial',
    desc: 'Planifica toda la semana con vista clara por fecha y estado.',
    img: UNS('1461749280684-dccba630e2f6'),
  },
  {
    title: 'Bandeja de contenido',
    desc: 'Controla borradores, aprobaciones y publicaciones programadas.',
    img: UNS('1460925895917-afdab827c52f'),
  },
  {
    title: 'Edición visual',
    desc: 'Ajusta imágenes y copies desde un único panel de trabajo.',
    img: UNS('1467232004584-a241de8bcf5d'),
  },
  {
    title: 'Métricas y resultados',
    desc: 'Sigue alcance, engagement y crecimiento por publicación.',
    img: UNS('1488229297570-58520851e868'),
  },
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
  { name: 'María González', biz: 'Heladería Toscana, Barcelona', quote: 'En pocas semanas, el local empezó a llenarse, sobre todo de gente joven que venía por lo que veía en Instagram. Ahora tengo más clientes entrando cada día.' },
  { name: 'Carlos Martín', biz: 'Cafetería El Rincón, Madrid', quote: 'Han captado perfectamente el tono de mi negocio y lo que quiero transmitir. Ahora mi Instagram refleja de verdad mi marca... y se nota en los clientes.' },
  { name: 'Laura Jiménez', biz: 'Cafetería El Rincón, Madrid', quote: 'Han captado perfectamente el tono de mi negocio y lo que quiero transmitir. Ahora mi Instagram refleja de verdad mi marca... y se nota en los clientes.' },
];

const LOGOS = ['🍦 Heladería Toscana', '☕ Cafetería El Rincón', '🌮 Tacos & Co.', '💈 Barbería Retro', '🌸 Centro Estético Alma', '🍕 Pizzería Napoli', '👗 Boutique Mía', '🏋️ Gym Urban Fit'];

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [navShadow, setNavShadow] = useState(false);
  const [demoMode, setDemoMode] = useState<'videos' | 'fotos'>('videos');
  const [homeBilling, setHomeBilling] = useState<'monthly' | 'annual'>('annual');
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

  const navDropdownPanelStyle: React.CSSProperties = {
    display: 'none',
    position: 'absolute',
    top: '100%',
    left: -10,
    background: 'rgba(255,255,255,0.98)',
    border: '1px solid #e5e7eb',
    minWidth: 230,
    zIndex: 100,
    padding: '10px',
    boxShadow: '0 18px 34px rgba(17,24,39,0.12)',
    backdropFilter: 'blur(6px)',
  };

  const navDropdownItemStyle: React.CSSProperties = {
    display: 'block',
    padding: '9px 10px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#374151',
    textDecoration: 'none',
    textTransform: 'none',
    borderBottom: '1px solid #f3f4f6',
  };

  const homePlans = [
    {
      name: 'Starter',
      monthlyPrice: 29,
      desc: 'Para tener una presencia activa y profesional en redes',
      features: [
        '2 posts de foto por semana',
        'Carruseles hasta 3 fotos',
        'Publicación programada',
        'Edición y creación de contenido',
        'Solicitudes de contenido personalizadas',
        'Generación con IA integrada',
        'Calendario de contenido básico',
      ],
    },
    {
      name: 'Pro',
      monthlyPrice: 89,
      desc: 'Para convertir tus redes en una máquina de ventas',
      featured: true,
      badge: '⚡ Más popular',
      features: [
        '4 fotos + 2 vídeos por semana',
        'Carruseles hasta 8 fotos',
        'Publicación programada y calendario avanzado',
        'Ideas de contenido + creación a medida',
        'Mejores horas para publicar',
        'Solicitudes de contenido personalizadas',
        'Análisis de rendimiento y mejoras',
        'Generación con IA integrada',
        'Soporte prioritario',
      ],
    },
    {
      name: 'Total',
      monthlyPrice: 189,
      desc: 'Para convertir tus redes en tu principal canal de captación de clientes',
      badge: '🚀 Completo',
      features: [
        'Hasta 20 fotos + 10 vídeos por semana',
        'Carruseles hasta 20 fotos',
        'Publicación programada y calendario avanzado',
        'Ideas + contenido basado en tendencias',
        'Solicitudes de contenido personalizadas',
        'Análisis de rendimiento y mejoras continuas',
        'Generación con IA integrada',
        'Soporte prioritario 24h',
      ],
    },
  ];

  const homeDisplayPrice = (monthlyPrice: number) =>
    homeBilling === 'annual' ? Math.round(monthlyPrice * 0.85) : monthlyPrice;

  const homeSavings = (monthlyPrice: number) =>
    Math.round((monthlyPrice - Math.round(monthlyPrice * 0.85)) * 12);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '¿Tengo que hacer algo o lo hacéis todo vosotros?', acceptedAnswer: { '@type': 'Answer', text: 'No. Nos encargamos de todo: desde la idea hasta la publicación. Puedes elegir si prefieres que nuestro equipo lo gestione o si quieres crear contenido tú mismo desde la plataforma.' } },
      { '@type': 'Question', name: '¿Puedo generar contenido yo mismo?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. Puedes crear contenido directamente desde la plataforma utilizando nuestras herramientas. También puedes inspirarte en ideas y generar imágenes o vídeos a partir de ellas.' } },
      { '@type': 'Question', name: '¿Puedo usar mis propias fotos o vídeos?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. Puedes subir tu contenido y nosotros lo utilizamos para crear publicaciones más profesionales y optimizadas.' } },
      { '@type': 'Question', name: '¿Tengo que aprobar el contenido?', acceptedAnswer: { '@type': 'Answer', text: 'Tú decides. Antes de publicar, puedes revisar y aprobar el contenido. Si lo prefieres, también podemos gestionarlo automáticamente.' } },
      { '@type': 'Question', name: '¿Cuánto tiempo tengo que dedicarle?', acceptedAnswer: { '@type': 'Answer', text: 'Muy poco o ninguno. Puedes delegarlo completamente en nuestro equipo o usar la plataforma cuando lo necesites.' } },
      { '@type': 'Question', name: '¿Qué tipo de negocios pueden usar NeuroPost?', acceptedAnswer: { '@type': 'Answer', text: 'Trabajamos con negocios locales como restaurantes, gimnasios, centros de estética, inmobiliarias y más. Cualquier negocio que quiera mejorar su presencia en redes.' } },
      { '@type': 'Question', name: '¿En qué redes sociales publicáis?', acceptedAnswer: { '@type': 'Answer', text: 'Actualmente nos centramos en Instagram y Facebook, donde los negocios locales obtienen mejores resultados.' } },
      { '@type': 'Question', name: '¿Mis fotos y contenido son privados?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. Todo tu contenido es privado y solo tú tienes acceso. Cumplimos con GDPR.' } },
      { '@type': 'Question', name: '¿Puedo cancelar cuando quiera?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. Puedes cancelar en cualquier momento sin permanencias. Sin trampas ni letra pequeña.' } },
    ],
  };

  return (
    <>
      <Script id="faq-schema" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {/* ─── NAV ─── */}
      <nav style={{ boxShadow: navShadow ? '0 1px 0 #e5e7eb' : 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" className="nav-logo">NeuroPost</a>
        <ul className="nav-links">
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="#funciones" style={{ cursor: 'pointer' }}>Producto</a>
            <div data-drop style={navDropdownPanelStyle}>
              <a href="#funciones" style={navDropdownItemStyle}>Portfolio</a>
              <a href="#sectores" style={navDropdownItemStyle}>Sectores</a>
              <a href="#como-funciona" style={navDropdownItemStyle}>Cómo funciona</a>
              <a href="#demo" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>Demo app</a>
            </div>
          </li>
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="#resultados" style={{ cursor: 'pointer' }}>Impacto</a>
            <div data-drop style={navDropdownPanelStyle}>
              <a href="#resultados" style={navDropdownItemStyle}>Resultados</a>
              <a href="#testimonios" style={navDropdownItemStyle}>Clientes</a>
              <a href="#faq" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>FAQ</a>
            </div>
          </li>
          <li><a href="/pricing">Precios</a></li>
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="#testimonios" style={{ cursor: 'pointer' }}>Empresa</a>
            <div data-drop style={navDropdownPanelStyle}>
              <Link href="/about" style={navDropdownItemStyle}>Sobre nosotros</Link>
              <Link href="/about#valores" style={navDropdownItemStyle}>Valores</Link>
              <Link href="/about#equipo" style={navDropdownItemStyle}>Equipo</Link>
              <Link href="/about#contacto" style={navDropdownItemStyle}>Contacto</Link>
              <Link href="/novedades" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>Novedades</Link>
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
                <img src={p.img} alt={p.caption} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
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
        <div className="fade-in steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: '32px 28px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '3rem', color: '#e5e7eb', lineHeight: 1, marginBottom: 16 }}>{n}</p>
              <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 16, textTransform: 'uppercase', color: '#111111', marginBottom: 8 }}>{title}</p>
              <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DEMO DEL PRODUCTO ─── */}
      <section id="demo" style={{ padding: '80px 0', background: '#111111' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 34%) minmax(0, 66%)', gap: 32, alignItems: 'start' }} className="fade-in demo-grid">
            <div>
              <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#14b8a6', marginBottom: 12 }}>
                Tour del producto
              </div>
              <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 0.95, marginBottom: 14 }}>
                Mira la app
                <br />
                por dentro
              </h2>
              <p style={{ fontFamily: f, fontSize: 15, color: '#9ca3af', lineHeight: 1.7, marginBottom: 20 }}>
                Visualiza cómo se usa NeuroPost con demos reales en vídeo y capturas de cada flujo.
              </p>

              <div style={{ display: 'inline-flex', border: '1px solid #374151', marginBottom: 16 }}>
                <button
                  onClick={() => setDemoMode('videos')}
                  style={{
                    padding: '9px 16px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: f,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    background: demoMode === 'videos' ? '#14b8a6' : 'transparent',
                    color: demoMode === 'videos' ? '#052e2b' : '#d1d5db',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Videos
                </button>
                <button
                  onClick={() => setDemoMode('fotos')}
                  style={{
                    padding: '9px 16px',
                    border: 'none',
                    borderLeft: '1px solid #374151',
                    cursor: 'pointer',
                    fontFamily: f,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    background: demoMode === 'fotos' ? '#14b8a6' : 'transparent',
                    color: demoMode === 'fotos' ? '#052e2b' : '#d1d5db',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Fotos
                </button>
              </div>

              <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                Consejo: empieza por videos para ver el flujo completo y luego revisa las capturas en detalle.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {demoMode === 'videos' && DEMO_VIDEOS.map((item) => (
                <article key={item.title} style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
                  <video controls preload="metadata" poster={item.poster} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block', background: '#0a0a0a' }}>
                    <source src={item.src} type="video/mp4" />
                  </video>
                  <div style={{ padding: '14px 14px 16px' }}>
                    <p style={{ fontFamily: fc, fontWeight: 700, textTransform: 'uppercase', color: '#ffffff', fontSize: 17, marginBottom: 6 }}>{item.title}</p>
                    <p style={{ fontFamily: f, color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </article>
              ))}

              {demoMode === 'fotos' && DEMO_PHOTOS.map((item) => (
                <article key={item.title} style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.img} alt={item.title} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '14px 14px 16px' }}>
                    <p style={{ fontFamily: fc, fontWeight: 700, textTransform: 'uppercase', color: '#ffffff', fontSize: 17, marginBottom: 6 }}>{item.title}</p>
                    <p style={{ fontFamily: f, color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING — scroll horitzontal ─── */}
      <section className="pricing" id="precios" style={{ padding: '80px 0', background: '#f5f5f5' }}>
        <div className="container" style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>Precios claros</div>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', color: '#111111', lineHeight: 0.95 }}>
            Sin sorpresas. Cancela cuando quieras.
          </h2>
          <p style={{ fontFamily: f, fontSize: 15, color: '#6b7280', marginTop: 12 }}>5 días de prueba gratuita en todos los planes.</p>
          <div style={{ display: 'inline-flex', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '0', padding: '4px', gap: '4px', marginTop: 24 }}>
            {(['monthly', 'annual'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setHomeBilling(cycle)}
                style={{
                  padding: '9px 22px',
                  borderRadius: '0',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: f,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  transition: 'all 0.2s',
                  background: homeBilling === cycle ? 'var(--orange)' : 'transparent',
                  color: homeBilling === cycle ? '#ffffff' : 'var(--muted)',
                }}
              >
                {cycle === 'monthly' ? 'Mensual' : 'Anual'}
                {cycle === 'annual' && (
                  <span
                    style={{
                      marginLeft: '6px',
                      background: homeBilling === 'annual' ? 'rgba(255,255,255,0.2)' : 'var(--orange-light)',
                      color: homeBilling === 'annual' ? '#ffffff' : 'var(--orange)',
                      borderRadius: '0',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    −15%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="container">
          <div style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 10, paddingBottom: 4 }}>
            <div className="pricing-home-grid" style={{ minWidth: 780, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
            {homePlans.map(({ name, monthlyPrice, desc, featured, badge, features }) => (
              <div key={name} className="pricing-home-card" style={{ background: featured ? '#111111' : '#ffffff', border: featured ? 'none' : '1px solid #e5e7eb', padding: '40px 24px', display: 'flex', flexDirection: 'column' }}>
                {(badge || featured) && (
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0F766E', background: '#f0fdf4', padding: '3px 10px', alignSelf: 'flex-start', marginBottom: 16 }}>
                    {badge ?? 'Más popular'}
                  </span>
                )}
                <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: featured ? '#ffffff' : '#111111', marginBottom: 4 }}>{name}</p>
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '3rem', color: featured ? '#ffffff' : '#111111', lineHeight: 1, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, verticalAlign: 'top' }}>€</span>{homeDisplayPrice(monthlyPrice)}<span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af' }}>/mes</span>
                </p>
                {homeBilling === 'annual' && (
                  <p style={{ fontFamily: f, fontSize: 12, fontWeight: 700, color: featured ? '#d1d5db' : '#0F766E', marginBottom: 10 }}>
                    {`Ahorras €${homeSavings(monthlyPrice)}/año`}
                  </p>
                )}
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
                  👉 Empezar gratis →
                </Link>
              </div>
            ))}
            </div>
          </div>
        </div>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Link href="/pricing" style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111111', textDecoration: 'none', border: '1px solid #d1d5db', padding: '10px 16px', background: '#ffffff' }}>
              Ver más detalles de planes →
            </Link>
          </div>
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

      <SiteFooter />
    </>
  );
}
