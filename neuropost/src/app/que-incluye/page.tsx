'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── CSS ──────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.88); }
    to   { opacity: 1; transform: scale(1); }
  }

  .animate-hero-title { opacity: 0; animation: fadeSlideUp .7s cubic-bezier(.22,1,.36,1) .1s forwards; }
  .animate-hero-sub   { opacity: 0; animation: fadeSlideUp .7s cubic-bezier(.22,1,.36,1) .28s forwards; }

  .observe-fade  { opacity: 0; transform: translateY(24px); transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1); }
  .observe-fade.is-visible { opacity: 1; transform: translateY(0); }
  .observe-scale { opacity: 0; transform: scale(.94); transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1); }
  .observe-scale.is-visible { opacity: 1; transform: scale(1); }
  .stagger-item  { opacity: 0; transform: translateY(16px); transition: opacity .4s ease, transform .4s ease; }
  .stagger-item.is-visible { opacity: 1; transform: translateY(0); }
  .table-row-anim { opacity: 0; transform: translateX(-12px); transition: opacity .4s ease, transform .4s ease; }
  .table-row-anim.is-visible { opacity: 1; transform: translateX(0); }

  .row-hover:hover .td-starter  { background: #f0fdf4 !important; }
  .row-hover:hover .td-format   { background: #f9fafb !important; }
  .table-pro-hover:hover        { background: #bbf7d0 !important; }
  .table-total-hover:hover      { background: #1f1f1f !important; }

  .cta-btn { transition: transform .18s ease, box-shadow .18s ease; }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15,118,110,.35); }
  .cta-btn-outline { transition: transform .18s ease, background .18s ease; }
  .cta-btn-outline:hover { transform: translateY(-2px); background: rgba(255,255,255,.08); }

  /* Service section responsive grids */
  .svc-header    { display: grid; grid-template-columns: minmax(260px,5fr) minmax(260px,4fr); gap: 0 72px; align-items: start; }
  .svc-point     { display: grid; grid-template-columns: 52px 200px 1fr; gap: 0 28px; align-items: start; }
  .svc-left-col  { position: relative; overflow: hidden; min-height: 120px; }
  .svc-right-col { padding-top: 20px; }

  @media (max-width: 860px) {
    .svc-header    { grid-template-columns: 1fr; gap: 0; }
    .svc-point     { grid-template-columns: 40px 1fr; gap: 0 16px; }
    .svc-point-desc { grid-column: 2; margin-top: 4px; }
    .svc-left-col  { min-height: 0; overflow: visible; }
    .svc-right-col { padding-top: 0; margin-top: 20px; }
    .svc-stat      { display: none; }
  }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const FORMATS = [
  { title: 'Posts',     plans: { starter: '2',  pro: '4', total: '7'  } },
  { title: 'Vídeos',    plans: { starter: '0',  pro: '2', total: '7'  } },
  { title: 'Historias', plans: { starter: '3',  pro: '5', total: '12' } },
];

const SERVICES = [
  {
    id: 'publicacion', label: 'Publicación automática', stat: 'AUTO',
    title: 'Tu Instagram en piloto automático',
    subtitle: 'Publicas sin hacer nada. Nosotros lo gestionamos todo.',
    body: 'Conecta una vez y olvídate. El contenido se crea, programa y publica automáticamente en el momento en que tu audiencia está más activa. Tú apruebas con un clic — o ni eso, si activas la publicación automática.',
    note: 'Tú solo das el OK — o lo publicamos directamente si lo prefieres. Nosotros creamos, programamos y publicamos todo de principio a fin.',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Cero intervención manual', desc: 'Conexión directa con Instagram via API oficial de Meta. Sin apps de terceros, sin copiar-pegar.' },
      { title: 'Calendario editorial',     desc: 'Vista mensual de todo tu contenido planificado. Aprueba, edita o cambia fechas con un clic.' },
      { title: 'Momento exacto',           desc: 'Publicamos cuando tu audiencia específica está activa. Más visibilidad desde el primer segundo.' },
      { title: 'Aprobación flexible',      desc: 'Revisa antes de publicar, activa aprobación automática, o una combinación de ambas.' },
    ],
  },
  {
    id: 'fotos', label: 'Fotografía', stat: '20×',
    title: 'Fotos que detienen el scroll',
    subtitle: 'De una sola foto sacamos múltiples piezas de contenido',
    body: 'Sube tus fotos en bruto y nosotros las convertimos en contenido profesional — con diferentes composiciones, textos y estilos para que cada semana se vea fresco sin tener que fotografiar más.',
    note: 'Esencial: 2/sem · Crecimiento: 4/sem · Profesional: hasta 20/sem',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Una foto, múltiples versiones', desc: 'Versionamos cada imagen con diferentes encuadres, textos y estilos. Más contenido, menos esfuerzo de tu parte.' },
      { title: 'Edición profesional',           desc: 'Color, contraste, retoque y composición. Cada foto optimizada para parar el scroll.' },
      { title: 'Texto, diseño e identidad',     desc: 'Añadimos texto, logotipos y gráficos que refuerzan tu marca en cada pieza.' },
      { title: 'Feed coherente que vende',      desc: 'Misma estética semana a semana. Tu perfil transmite profesionalidad — y eso genera confianza y clientes.' },
    ],
  },
  {
    id: 'ia', label: 'Inteligencia Artificial', stat: 'AI',
    title: 'IA que habla como tú, no como un robot',
    subtitle: 'Entrenada con tu marca. Actualizada con las tendencias de tu sector.',
    body: 'Cada caption, idea y estrategia pasa por tu perfil de marca antes de salir. No es automatización genérica — es tu voz, amplificada por tecnología.',
    note: 'La IA aprende de tu marca, no de una plantilla genérica. Cuanto más se usa, mejor habla como tú.',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Captions que convierten', desc: 'Textos en tu tono exacto: cercano, profesional o técnico. Siempre con una llamada a la acción.' },
      { title: 'Ideas frescas cada semana', desc: 'Analizamos las tendencias de tu sector y generamos ideas alineadas con lo que funciona ahora.' },
      { title: 'Hashtags inteligentes',    desc: 'Selección por nicho, volumen y competencia. Ni tan grandes que te invisibilizan, ni tan pequeños que no traen tráfico.' },
      { title: 'Imágenes generadas',       desc: '¿Sin foto esta semana? Generamos imágenes con IA adaptadas a tu marca para no perder presencia.' },
    ],
  },
  {
    id: 'solicitudes', label: 'Solicitudes especiales', stat: '24h',
    title: 'Tienes una idea. En 24h está hecha.',
    subtitle: 'Oferta flash, lanzamiento, fecha especial — lo que sea, cuando sea',
    body: 'En cualquier momento puedes pedir contenido concreto. Lo creamos y lo tenemos listo en 24-48h laborables. Sin formularios complicados, sin esperar semanas.',
    note: 'Disponible en todos los planes · Sin límite de solicitudes',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Sin límite de peticiones', desc: 'Pide lo que necesites cuando lo necesites. Fechas especiales, ofertas flash, lanzamientos de producto.' },
      { title: 'Entrega en 24-48h',        desc: 'Todo listo en 24-48h laborables. Si es urgente, basta con indicarlo y lo priorizamos.' },
      { title: 'Tu voz, nuestro trabajo',  desc: 'Cada pieza refleja exactamente lo que quieres comunicar, en tu tono y con tu identidad visual.' },
      { title: 'Historial completo',       desc: 'Todas las solicitudes visibles en tu dashboard con estado, fecha de entrega y resultado.' },
    ],
  },
  {
    id: 'analytics', label: 'Analytics', stat: '%',
    title: 'Sabes qué funciona. Y lo potenciamos.',
    subtitle: 'Cada decisión respaldada por datos reales de tu cuenta',
    body: 'Medimos el rendimiento de cada publicación y usamos esos datos para mejorar el siguiente ciclo. No hay suposiciones — hay números.',
    note: 'Disponible en todos los planes · Datos actualizados automáticamente',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Métricas por publicación', desc: 'Alcance, impresiones, likes, comentarios, guardados y compartidos — todo en un solo lugar.' },
      { title: 'Evolución del perfil',     desc: 'Seguimiento de seguidores, engagement y comparativas semana a semana.' },
      { title: 'Mejora continua',          desc: 'Lo que funciona, lo escalamos. Lo que no, lo ajustamos antes de la siguiente semana.' },
      { title: 'Dashboard sin jerga',      desc: 'Un vistazo y sabes si tu inversión está generando resultados. Sin tecnicismos.' },
    ],
  },
  {
    id: 'carruseles', label: 'Carruseles', stat: '1→20',
    title: 'Carruseles que hacen swipe solos',
    subtitle: 'El formato que más tiempo retiene al usuario en tu perfil',
    body: 'Diseñamos cada carrusel para que el usuario no pueda parar de deslizar. Ideales para mostrar proceso, resultados o contenido educativo que construye confianza.',
    note: 'Esencial: hasta 3 fotos · Crecimiento: hasta 8 · Profesional: hasta 20 por carrusel',
    plans: ['Esencial', 'Crecimiento', 'Profesional'],
    points: [
      { title: 'Hasta 20 diapositivas', desc: 'Más contenido por publicación = más tiempo de visualización = más alcance orgánico.' },
      { title: 'Primera imagen gancho', desc: 'Diseñada específicamente para captar atención y provocar el primer deslizamiento.' },
      { title: 'Copy imagen a imagen',  desc: 'Cada diapositiva tiene su texto. La historia avanza, el usuario sigue.' },
      { title: 'Hashtags por nicho',    desc: 'Hashtags estratégicos adapatados al sector y al contenido. Actívalos o desactívalos desde ajustes.' },
    ],
  },
  {
    id: 'video', label: 'Vídeos cortos', stat: '20"',
    title: 'El formato que el algoritmo amplifica',
    subtitle: 'Vídeos editados para el máximo alcance orgánico posible',
    body: 'Los vídeos cortos son el contenido que más amplifica el algoritmo. Editamos cada pieza para que llegue al mayor número de personas posible — sin perder el mensaje en el proceso.',
    note: 'Disponible en Crecimiento y Profesional · Garantía de edición incluida',
    plans: ['Crecimiento', 'Profesional'],
    points: [
      { title: 'Máximo alcance orgánico', desc: 'El algoritmo de Instagram prioriza los vídeos cortos por encima de cualquier otro formato.' },
      { title: 'Edición sin perder el mensaje', desc: 'Cortamos y montamos respetando el ritmo y el contenido clave. Nada innecesario.' },
      { title: 'Listo para publicar',     desc: 'Formato, resolución y duración optimizados para que Instagram lo distribuya al máximo.' },
      { title: 'Orientado a resultados',  desc: 'Más alcance → más personas descubren tu negocio → más oportunidades de venta.' },
    ],
  },
];

const PLAN_BADGES: Record<string, { bg: string; color: string }> = {
  Starter:      { bg: '#f5f5f5', color: '#374151' },
  Pro:          { bg: '#e6f9f0', color: '#0F766E' },
  Total:        { bg: '#111111', color: '#ffffff' },
  Esencial:     { bg: '#f5f5f5', color: '#374151' },
  Crecimiento:  { bg: '#e6f9f0', color: '#0F766E' },
  Profesional:  { bg: '#111111', color: '#ffffff' },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useScrollAnimate() {
  useEffect(() => {
    const targets = document.querySelectorAll('.observe-fade, .observe-scale, .stagger-item, .table-row-anim');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }),
      { threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
}

// ─── ServiceSection ───────────────────────────────────────────────────────────

function ServiceSection({ svc, idx }: { svc: typeof SERVICES[0]; idx: number }) {
  const isDark  = idx === 3;
  const bg      = isDark ? '#0f0f0f' : idx % 2 === 0 ? '#ffffff' : '#F7F9FB';
  const ink     = isDark ? '#ffffff' : '#111111';
  const muted   = isDark ? '#6b7280' : '#6b7280';
  const border  = isDark ? '#1e1e1e' : '#e5e7eb';
  const statClr = isDark ? 'rgba(15,118,110,0.18)' : 'rgba(15,118,110,0.07)';

  return (
    <section id={svc.id} style={{ background: bg, borderBottom: `1px solid ${border}` }}>
      <div className="container" style={{ paddingTop: 80, paddingBottom: 64 }}>

        {/* ── Header ── */}
        <div className="svc-header observe-fade" style={{ paddingBottom: 52, borderBottom: `1px solid ${border}` }}>

          {/* Left: stat overlay + label + title */}
          <div className="svc-left-col">
            <div className="svc-stat" style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(4.5rem, 10vw, 8rem)',
              lineHeight: 0.85, letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              color: statClr,
              position: 'absolute', top: -10, right: -4,
              userSelect: 'none', pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              {svc.stat}
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#0F766E', display: 'block', marginBottom: 14 }}>
                {svc.label}
              </span>
              <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 3.2vw, 2.7rem)', textTransform: 'uppercase', lineHeight: 0.92, color: ink, marginBottom: 14, letterSpacing: '-0.01em' }}>
                {svc.title}
              </h2>
              <p style={{ fontFamily: f, fontSize: 14, fontWeight: 600, color: '#0F766E', margin: 0, lineHeight: 1.5, maxWidth: 380 }}>
                {svc.subtitle}
              </p>
            </div>
          </div>

          {/* Right: body + plan badges */}
          <div className="svc-right-col">
            <p style={{ fontFamily: f, fontSize: 15, color: muted, lineHeight: 1.8, marginBottom: 28 }}>
              {svc.body}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Incluido en:
              </span>
              {svc.plans.map((p) => (
                <span key={p} style={{ fontFamily: fc, fontSize: 11, fontWeight: 700, padding: '4px 12px', background: (PLAN_BADGES[p] ?? PLAN_BADGES.Esencial).bg, color: (PLAN_BADGES[p] ?? PLAN_BADGES.Esencial).color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Numbered points ── */}
        <div>
          {svc.points.map((pt, i) => (
            <div
              key={pt.title}
              className="svc-point stagger-item"
              style={{ padding: '22px 0', borderBottom: i < svc.points.length - 1 ? `1px solid ${border}` : 'none', transitionDelay: `${i * 65}ms` }}
            >
              <div style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.3rem, 2.4vw, 1.9rem)', color: '#0F766E', opacity: 0.3, lineHeight: 1.1, letterSpacing: '-0.02em', paddingTop: 2 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: ink, paddingTop: 3, lineHeight: 1.3 }}>
                {pt.title}
              </div>
              <div className="svc-point-desc" style={{ fontFamily: f, fontSize: 14, color: muted, lineHeight: 1.7 }}>
                {pt.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ── Note ── */}
        <div style={{ marginTop: 36, padding: '11px 16px', borderLeft: '3px solid #0F766E', background: isDark ? '#161616' : '#f9fafb' }}>
          <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', margin: 0 }}>{svc.note}</p>
        </div>

      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueIncluyePage() {
  useScrollAnimate();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <LandingNav />

      {/* ── HERO ── */}
      <section style={{ padding: '120px 0 80px', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="animate-hero-title" style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#0F766E', marginBottom: 20 }}>
            Todo lo que incluye
          </div>
          <h1 className="animate-hero-title" style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.8rem, 6vw, 4.8rem)', textTransform: 'uppercase', lineHeight: 0.9, color: '#111111', marginBottom: 24, animationDelay: '.08s' }}>
            Cada formato.<br />Cada detalle.<br />
            <span style={{ color: '#0F766E' }}>Sin excepciones.</span>
          </h1>
          <p className="animate-hero-sub" style={{ fontFamily: f, fontSize: 17, color: '#6b7280', lineHeight: 1.7, maxWidth: 580 }}>
            NeuroPost gestiona tu Instagram de principio a fin. Aquí tienes exactamente qué hacemos, cómo lo hacemos y qué está incluido en cada plan.
          </p>
        </div>
      </section>

      {/* ── OVERVIEW TABLE ── */}
      <section style={{ padding: '72px 0', background: '#F7F9FB', borderBottom: '1px solid #e5e7eb' }}>
        <div className="container">
          <div className="observe-fade" style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#0F766E', marginBottom: 10 }}>De un vistazo</div>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', textTransform: 'uppercase', color: '#111111', margin: 0, lineHeight: 0.95 }}>
              Qué se produce cada semana
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr className="observe-fade" style={{ borderBottom: '2px solid #111111' }}>
                  <th style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '14px 16px', color: '#111111', width: '30%' }}>Formato</th>
                  <th style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', padding: '14px 16px', color: '#374151' }}>Esencial</th>
                  <th style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', padding: '14px 16px', color: '#0F766E', background: '#f0fdf4' }}>Crecimiento</th>
                  <th style={{ fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', padding: '14px 16px', color: '#ffffff', background: '#111111' }}>Profesional</th>
                </tr>
              </thead>
              <tbody>
                {FORMATS.map((fmt, i) => (
                  <tr key={fmt.title} className="table-row-anim row-hover" style={{ borderBottom: '1px solid #e5e7eb', transitionDelay: `${i * 80}ms` }}>
                    <td className="td-format" style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, fontWeight: 600, color: '#111111', transition: 'background .15s ease' }}>{fmt.title}</td>
                    <td className="td-starter" style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, color: '#374151', textAlign: 'center', background: '#ffffff', transition: 'background .15s ease' }}>{fmt.plans.starter}</td>
                    <td className="table-pro-hover" style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, color: '#0F766E', fontWeight: 600, textAlign: 'center', background: '#f0fdf4', transition: 'background .15s ease' }}>{fmt.plans.pro}</td>
                    <td className="table-total-hover" style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, color: '#ffffff', fontWeight: 600, textAlign: 'center', background: '#111111', transition: 'background .15s ease' }}>{fmt.plans.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SERVICE SECTIONS ── */}
      {SERVICES.map((svc, idx) => (
        <ServiceSection key={svc.id} svc={svc} idx={idx} />
      ))}

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '120px 0', background: '#111111' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 680 }}>
          <div className="observe-fade" style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#0F766E', marginBottom: 20 }}>
            Todo incluido
          </div>
          <h2 className="observe-scale" style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 4rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 0.9, marginBottom: 20 }}>
            Listo para empezar<br />
            <span style={{ color: '#0F766E' }}>desde esta semana</span>
          </h2>
          <p className="observe-fade" style={{ fontFamily: f, fontSize: 16, color: '#9ca3af', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 48px' }}>
            Elige tu plan, conecta tu Instagram y en 48 horas tienes tu primer contenido listo para publicar.
          </p>
          <div className="observe-fade" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="cta-btn" style={{ display: 'inline-block', padding: '16px 44px', background: '#0F766E', color: '#ffffff', textDecoration: 'none', fontFamily: fc, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Empezar →
            </Link>
            <Link href="/pricing" className="cta-btn-outline" style={{ display: 'inline-block', padding: '16px 44px', background: 'transparent', color: '#ffffff', textDecoration: 'none', fontFamily: fc, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid #333' }}>
              Ver precios
            </Link>
          </div>
          <p className="observe-fade" style={{ fontFamily: f, fontSize: 12, color: '#4b5563', marginTop: 32 }}>
            Cancela cuando quieras · Soporte incluido
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
