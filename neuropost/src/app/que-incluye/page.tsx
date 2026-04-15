'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.88); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes iconBounce {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.22); }
    65%  { transform: scale(0.92); }
    80%  { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .animate-hero-title  { opacity: 0; animation: fadeSlideUp .7s cubic-bezier(.22,1,.36,1) .1s forwards; }
  .animate-hero-sub    { opacity: 0; animation: fadeSlideUp .7s cubic-bezier(.22,1,.36,1) .25s forwards; }
  .animate-hero-pills  { opacity: 0; animation: fadeSlideUp .7s cubic-bezier(.22,1,.36,1) .4s forwards; }

  .observe-fade    { opacity: 0; transform: translateY(28px); transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1); }
  .observe-fade.is-visible { opacity: 1; transform: translateY(0); }

  .observe-scale   { opacity: 0; transform: scale(.93); transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1); }
  .observe-scale.is-visible { opacity: 1; transform: scale(1); }

  .stagger-item    { opacity: 0; transform: translateY(20px); transition: opacity .45s ease, transform .45s ease; }
  .stagger-item.is-visible { opacity: 1; transform: translateY(0); }

  .table-row-anim  { opacity: 0; transform: translateX(-12px); transition: opacity .4s ease, transform .4s ease; }
  .table-row-anim.is-visible { opacity: 1; transform: translateX(0); }

  .icon-wrap { display: inline-flex; will-change: transform; }
  .icon-wrap.bouncing { animation: iconBounce .6s cubic-bezier(.22,1,.36,1) forwards; }

  .card-hover {
    transition: transform .22s ease, box-shadow .22s ease;
    cursor: default;
  }
  .card-hover:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 32px rgba(0,0,0,.08);
    z-index: 2;
  }

  .pill-btn {
    transition: background .18s ease, color .18s ease, transform .18s ease, border-color .18s ease;
  }
  .pill-btn:hover { transform: translateY(-1px); }
  .pill-btn.active {
    background: #0F766E !important;
    color: #ffffff !important;
    border-color: #0F766E !important;
    transform: translateY(-1px);
  }

  .cta-btn {
    transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
  }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15,118,110,.35); }

  .cta-btn-outline {
    transition: transform .18s ease, background .18s ease, color .18s ease;
  }
  .cta-btn-outline:hover { transform: translateY(-2px); background: rgba(255,255,255,.08); }

  .row-hover { transition: background .15s ease; }
  .row-hover:hover td { background: #f0fdf4 !important; }

  .carousel-track::-webkit-scrollbar { display: none; }

  .carousel-btn {
    width: 36px; height: 36px;
    background: #ffffff; border: 1px solid #e5e7eb;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #374151;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
    user-select: none;
  }
  .carousel-btn:hover { background: #0F766E; border-color: #0F766E; color: #ffffff; }
  .carousel-btn:disabled { opacity: 0.3; cursor: default; }
  .carousel-btn:disabled:hover { background: #ffffff; border-color: #e5e7eb; color: #374151; }

  .table-pro-hover:hover { background: #dcfce7 !important; }
  .table-total-hover:hover { background: #1a1a1a !important; }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const FORMATS = [
  { title: 'Fotos',      id: 'fotos',      plans: { starter: '2/semana',         pro: '4/semana',            total: 'Hasta 20/semana'      } },
  { title: 'Vídeos',     id: 'video',      plans: { starter: '—',                pro: '2 reels ≤90s/semana', total: '10 reels ≤90s/semana' } },
  { title: 'Carruseles', id: 'carruseles', plans: { starter: 'Hasta 3 fotos',    pro: 'Hasta 8 fotos',       total: 'Hasta 20 fotos'       } },
];

const SERVICES = [
  {
    id: 'video', label: 'Regla de los 90 segundos',
    title: 'Vídeos editados para máximo alcance',
    subtitle: 'Todos los vídeos se editan a ≤90 segundos',
    body: 'Queremos que tus vídeos lleguen a más gente. Por eso todos se editan en máximo 90 segundos — el punto donde Instagram amplifica más tu contenido. Sin cortes abruptos. Con transiciones inteligentes. Solo resultados.',
    note: 'Garantía de alcance: si tu vídeo supera 90s, lo editamos sin perder el mensaje.',
    plans: ['Pro', 'Total'],
    points: [
      { title: 'Algoritmo prioritario',     desc: 'Instagram amplifica vídeos cortos (Reels). Los primeros 90s es donde el sistema te da más visibilidad y alcance orgánico.' },
      { title: 'Edición inteligente',       desc: 'Si tu vídeo supera 90 segundos, lo cortamos sin perder el mensaje. Priorizamos el mensaje clave, el ritmo y el impacto visual.' },
      { title: 'Rendimiento comprobado',    desc: 'La caída de alcance comienza después de 90s. Antes de ese límite = máximo alcance garantizado para tu negocio.' },
      { title: 'Mejor para conversión',     desc: 'Más alcance → más personas ven tu negocio → más leads → más ventas. Simple, pero funciona.' },
    ],
  },
  {
    id: 'fotos', label: 'Fotografía',
    title: 'Fotos profesionales adaptadas a tu marca',
    subtitle: 'No solo optimizamos imágenes — las transformamos en contenido que capta atención',
    body: 'Sube tus fotos y nosotros nos encargamos de todo: edición, corrección de color, composición, texto y adaptación creativa. Desde cambios sutiles hasta transformaciones completas de fondo, estilo y composición según el objetivo del contenido.',
    note: 'Starter: 2 fotos/semana · Pro: 4 fotos/semana · Total: hasta 20 fotos/semana',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Edición profesional',    desc: 'Corrección de color, contraste, brillo y composición. Cada foto queda optimizada para el feed de Instagram.' },
      { title: 'Texto y diseño',         desc: 'Añadimos texto, logotipos y elementos gráficos alineados con tu identidad de marca.' },
      { title: 'Adaptación creativa',    desc: 'Podemos modificar fondos, estilos y composición de la imagen. Desde cambios sutiles hasta transformaciones completas según el objetivo del contenido.' },
      { title: 'Efectos y animaciones',  desc: 'Si el contenido lo requiere, añadimos efectos visuales o pequeñas animaciones para hacerlo más dinámico y atractivo.' },
      { title: 'Formatos optimizados',              desc: 'Exportamos en el formato y resolución exactos que Instagram prioriza para máxima calidad.' },
      { title: 'Coherencia visual',                 desc: 'Mantenemos un feed consistente y profesional semana a semana.' },
      { title: 'Optimización para conversión',      desc: 'Adaptamos cada imagen para generar resultados reales: más clics, más interacción y más conversiones según el objetivo del contenido.' },
      { title: 'Dirección creativa estratégica',    desc: 'Definimos cómo debe verse cada pieza según tu marca, tu sector y lo que mejor está funcionando, asegurando coherencia y diferenciación.' },
    ],
  },
  {
    id: 'carruseles', label: 'Carruseles',
    title: 'Carruseles que retienen y convierten',
    subtitle: 'El formato que más tiempo mantiene al usuario en tu perfil',
    body: 'Los carruseles generan más tiempo de visualización que cualquier otro formato. Los usamos para mostrar proceso, resultados, productos o contenido educativo que construye autoridad y confianza en tu marca.',
    note: 'Starter: hasta 3 fotos · Pro: hasta 8 fotos · Total: hasta 20 fotos por carrusel',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Hasta 20 fotos por carrusel', desc: 'Según tu plan, creamos carruseles de hasta 3, 8 o 20 fotos. Más contenido por publicación = más tiempo de visualización.' },
      { title: 'Diseño para retención',        desc: 'Estructuramos cada carrusel para que el usuario quiera seguir deslizando hasta el final, manteniendo la atención en cada imagen.' },
      { title: 'Copy optimizado',              desc: 'Cada imagen lleva un texto corto y directo. La primera imagen está diseñada para captar la atención y hacer que el usuario deslice.' },
      { title: 'Hashtags',                     desc: 'Incluimos hashtags estratégicos cuando los necesites, adaptados a tu sector y optimizados para maximizar el alcance. Puedes activarlos o desactivarlos en cualquier momento desde ajustes.' },
    ],
  },
  {
    id: 'publicacion', label: 'Publicación y calendario',
    title: 'Publicación programada y calendario avanzado',
    subtitle: 'Publicamos cuando tu audiencia está más activa',
    body: 'Nos encargamos de programar y publicar todo el contenido de forma automática. Tú apruebas y nosotros publicamos en los momentos de mayor actividad de tu audiencia específica.',
    note: 'Mejores horas para publicar disponible en Pro y Total',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Publicación automática',    desc: 'Conexión directa con Instagram via API oficial de Meta. El contenido se publica sin que tengas que hacer nada.' },
      { title: 'Calendario editorial',       desc: 'Ve todo tu contenido planificado en un calendario mensual. Aprueba, edita o cambia fechas con un clic.' },
      { title: 'Mejores horas para publicar',desc: 'Analizamos cuándo está activa tu audiencia específica y programamos en ese momento. Más visibilidad desde el primer minuto.' },
      { title: 'Aprobación previa',          desc: 'Recibes cada post para revisión antes de que se publique. Aprueba, solicita cambios o déjanos publicar automáticamente.' },
    ],
  },
  {
    id: 'ia', label: 'Inteligencia Artificial',
    title: 'IA integrada en cada paso',
    subtitle: 'No es automatización genérica — es IA entrenada para tu negocio',
    body: 'Usamos modelos de lenguaje avanzados para generar captions, ideas de contenido, hashtags y estrategias. Todo el contenido pasa por tu perfil de marca para que suene exactamente como tú hablas.',
    note: 'Ideas basadas en tendencias disponibles en Pro y Total',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Captions que venden',        desc: 'Generamos textos adaptados al tono de tu marca: cercano, profesional, divertido o técnico. Con llamadas a la acción claras.' },
      { title: 'Ideas por tendencias',        desc: 'Analizamos las tendencias de tu sector cada semana y generamos ideas de contenido alineadas con lo que está funcionando ahora.' },
      { title: 'Hashtags inteligentes',       desc: 'Selección de hashtags por nicho, competencia y volumen. Ni demasiado grandes (invisibles) ni demasiado pequeños (sin tráfico).' },
      { title: 'Generación de imágenes',      desc: 'Si no tienes foto, generamos imágenes con IA adaptadas a tu sector y estilo de marca para no perder ninguna semana.' },
    ],
  },
  {
    id: 'analytics', label: 'Analytics',
    title: 'Análisis de rendimiento real',
    subtitle: 'Datos concretos para decisiones inteligentes',
    body: 'No trabajamos a ciegas. Analizamos el rendimiento de cada publicación y usamos esos datos para mejorar el contenido siguiente. Más engagement, más alcance, más resultados semana a semana.',
    note: 'Disponible en todos los planes · Actualizado automáticamente',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Métricas por publicación',   desc: 'Alcance, impresiones, likes, comentarios, guardados y compartidos. Ves exactamente qué contenido funciona mejor.' },
      { title: 'Rendimiento del perfil',      desc: 'Evolución de seguidores, tasa de engagement y comparativas semana a semana. Progreso visible y cuantificable.' },
      { title: 'Mejoras continuas',           desc: 'Los datos informan el siguiente ciclo de contenido. Si un formato funciona, lo potenciamos. Si no, lo ajustamos.' },
      { title: 'Dashboard accesible',         desc: 'Panel claro y sin jerga técnica. Ves de un vistazo si tu inversión está generando resultados.' },
    ],
  },
  {
    id: 'solicitudes', label: 'Solicitudes',
    title: 'Solicitudes de contenido personalizadas',
    subtitle: 'Tienes una idea — nosotros la ejecutamos',
    body: 'En cualquier momento puedes enviarnos una solicitud de contenido específico: una promoción, un nuevo producto, una fecha especial o cualquier cosa que quieras comunicar. Nosotros lo creamos y lo programamos.',
    note: 'Disponible en todos los planes · Respuesta en 24-48h laborables',
    plans: ['Starter', 'Pro', 'Total'],
    points: [
      { title: 'Sin límite de solicitudes',  desc: 'Puedes pedir el contenido que necesitas cuando lo necesitas. Fechas especiales, lanzamientos, ofertas flash — todo tiene cabida.' },
      { title: 'Respuesta en 24-48h',         desc: 'Procesamos todas las solicitudes en 24-48 horas laborables. Si es urgente, indícalo y lo priorizamos.' },
      { title: 'Tu voz, nuestro trabajo',     desc: 'Cada pieza de contenido refleja exactamente lo que quieres comunicar, en tu tono y con tu identidad visual.' },
      { title: 'Historial completo',           desc: 'Todas tus solicitudes quedan registradas en el dashboard con su estado, fecha de entrega y resultado final.' },
    ],
  },
];

const PLAN_BADGES: Record<string, { bg: string; color: string }> = {
  Starter: { bg: '#f5f5f5', color: '#374151' },
  Pro:     { bg: '#e6f9f0', color: '#0F766E' },
  Total:   { bg: '#111111', color: '#ffffff' },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useScrollAnimate() {
  useEffect(() => {
    const targets = document.querySelectorAll('.observe-fade, .observe-scale, .stagger-item, .table-row-anim, .icon-wrap-observe');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
}

function useIconBounce() {
  const ref = useRef<HTMLSpanElement>(null);
  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('bouncing');
    void el.offsetWidth;
    el.classList.add('bouncing');
    el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true });
  }, []);
  return { ref, trigger };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PointCard({ title, desc, delay }: { title: string; desc: string; delay: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="stagger-item card-hover"
      style={{
        background: '#ffffff', padding: '28px 24px',
        border: '1px solid #e5e7eb',
        transitionDelay: `${delay}ms`,
        position: 'relative',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,.08)' : '0 1px 3px rgba(0,0,0,.04)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0F766E', marginBottom: 10 }}>
        ✓ {title}
      </div>
      <p style={{ fontFamily: f, fontSize: 14, color: '#374151', lineHeight: 1.65, margin: 0 }}>{desc}</p>
    </div>
  );
}


function ServiceSection({ svc, idx }: { svc: typeof SERVICES[0]; idx: number }) {
  const sectionRef = useRef<HTMLElement>(null);

  const bg = idx % 2 === 0 ? '#ffffff' : '#F7F9FB';

  return (
    <section
      ref={sectionRef}
      id={svc.id}
      style={{ padding: '100px 0', background: bg, borderBottom: '1px solid #e5e7eb' }}
    >
      <div className="container">
        {/* Header */}
        <div
          className="observe-fade"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 60, marginBottom: 56, flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E' }}>
                {svc.label}
              </span>
            </div>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', textTransform: 'uppercase', lineHeight: 0.95, color: '#111111', marginBottom: 12 }}>
              {svc.title}
            </h2>
            <p style={{ fontFamily: f, fontSize: 14, fontWeight: 600, color: '#0F766E', letterSpacing: '0.02em', margin: 0 }}>
              {svc.subtitle}
            </p>
          </div>
          <div style={{ flex: '1 1 320px', paddingTop: 8 }}>
            <p style={{ fontFamily: f, fontSize: 15, color: '#6b7280', lineHeight: 1.75, marginBottom: 20 }}>
              {svc.body}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>Incluido en:</span>
              {svc.plans.map((p) => (
                <span key={p} style={{ fontFamily: f, fontSize: 11, fontWeight: 700, padding: '2px 10px', background: PLAN_BADGES[p].bg, color: PLAN_BADGES[p].color, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'transform .15s ease' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Points grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
          {svc.points.map((pt, i) => (
            <PointCard key={pt.title} title={pt.title} desc={pt.desc} delay={i * 90} />
          ))}
        </div>

        {/* Note bar */}
        <div
          className="observe-fade"
          style={{ background: '#f5f5f5', border: '1px solid #e5e7eb', padding: '12px 20px', marginTop: 8 }}
        >
          <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', margin: 0 }}>
            <span style={{ fontWeight: 700, color: '#374151' }}>Nota: </span>{svc.note}
          </p>
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
      <section style={{ padding: '120px 0 80px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div className="container" style={{ maxWidth: 920 }}>
          <div
            className="animate-hero-title"
            style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 20 }}
          >
            Todo lo que incluye
          </div>
          <h1
            className="animate-hero-title"
            style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.8rem, 6vw, 4.8rem)', textTransform: 'uppercase', lineHeight: 0.9, color: '#111111', marginBottom: 24, animationDelay: '.08s' }}
          >
            Cada formato.<br />Cada detalle.<br />
            <span style={{ color: '#0F766E', display: 'inline-block' }}>Sin excepciones.</span>
          </h1>
          <p
            className="animate-hero-sub"
            style={{ fontFamily: f, fontSize: 17, color: '#6b7280', lineHeight: 1.7, maxWidth: 600, marginBottom: 48 }}
          >
            NeuroPost gestiona tu Instagram de principio a fin. Aquí tienes exactamente qué hacemos, cómo lo hacemos y qué está incluido en cada plan.
          </p>

        </div>
      </section>

      {/* ── OVERVIEW TABLE ── */}
      <section style={{ padding: '80px 0', background: '#F7F9FB', borderBottom: '1px solid #e5e7eb' }}>
        <div className="container">
          <div className="observe-fade" style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 12 }}>
              De un vistazo
            </div>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', textTransform: 'uppercase', color: '#111111', margin: 0, lineHeight: 0.95 }}>
              Qué se produce cada semana
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
              <thead>
                <tr className="observe-fade" style={{ borderBottom: '2px solid #111111' }}>
                  <th style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', padding: '14px 16px', color: '#111111', width: '30%' }}>Formato</th>
                  <th style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '14px 16px', color: '#374151' }}>Starter</th>
                  <th style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '14px 16px', color: '#0F766E', background: '#f0fdf4' }}>Pro</th>
                  <th style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '14px 16px', color: '#ffffff', background: '#111111' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {FORMATS.map((fmt, i) => (
                  <tr
                    key={fmt.title}
                    className="table-row-anim row-hover"
                    style={{ borderBottom: '1px solid #e5e7eb', transitionDelay: `${i * 80}ms` }}
                  >
                    <td style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, fontWeight: 600, color: '#111111' }}>
                      {fmt.title}
                    </td>
                    <td style={{ padding: '16px 16px', fontFamily: f, fontSize: 14, color: '#374151', textAlign: 'center', background: '#ffffff' }}>{fmt.plans.starter}</td>
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
      <section style={{ padding: '120px 0', background: '#111111', overflow: 'hidden' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 720 }}>
          <div
            className="observe-fade"
            style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#0F766E', marginBottom: 20 }}
          >
            Todo incluido
          </div>
          <h2
            className="observe-scale"
            style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 4rem)', textTransform: 'uppercase', color: '#ffffff', lineHeight: 0.9, marginBottom: 20 }}
          >
            Listo para empezar<br />
            <span style={{ color: '#0F766E' }}>desde esta semana</span>
          </h2>
          <p
            className="observe-fade"
            style={{ fontFamily: f, fontSize: 16, color: '#9ca3af', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 48px' }}
          >
            Elige tu plan, conecta tu Instagram y en 48 horas tienes tu primer contenido listo para publicar.
          </p>
          <div
            className="observe-fade"
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <Link
              href="/register"
              className="cta-btn"
              style={{ display: 'inline-block', padding: '16px 44px', background: '#0F766E', color: '#ffffff', textDecoration: 'none', fontFamily: fc, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Empezar gratis →
            </Link>
            <Link
              href="/pricing"
              className="cta-btn-outline"
              style={{ display: 'inline-block', padding: '16px 44px', background: 'transparent', color: '#ffffff', textDecoration: 'none', fontFamily: fc, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid #333' }}
            >
              Ver precios
            </Link>
          </div>

          {/* Trust note */}
          <p
            className="observe-fade"
            style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 32 }}
          >
            Sin permanencias · Cancela cuando quieras · Soporte incluido
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
