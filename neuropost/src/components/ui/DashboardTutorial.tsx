'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Lightbulb, Plus, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'neuropost_tutorial_v1';

type Step = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    icon: <span style={{ fontSize: '2.5rem' }}>👋</span>,
    title: '¡Bienvenido a NeuroPost!',
    desc:  'En 4 pasos te enseñamos cómo sacarle el máximo partido. Solo tardas 2 minutos.',
  },
  {
    icon: <span style={{ fontSize: '2.5rem' }}>📱</span>,
    title: 'Conecta tus redes sociales',
    desc:  'Vincula Instagram, Facebook o TikTok para que NeuroPost pueda publicar y leer comentarios de forma automática.',
    cta:  { label: 'Conectar ahora', href: '/settings#redes' },
  },
  {
    icon: <Lightbulb size={40} color="#0F766E" />,
    title: 'Genera ideas de contenido',
    desc:  'Explícanos sobre qué quieres publicar y te prepararemos ideas adaptadas a tu sector y tono de marca.',
    cta:  { label: 'Ver ideas', href: '/ideas' },
  },
  {
    icon: <Plus size={40} color="#0F766E" />,
    title: 'Crea tu primer post',
    desc:  'Sube una foto, el equipo de NeuroPost escribe el caption y los hashtags, y tú decides cuándo publicarlo.',
    cta:  { label: 'Crear post', href: '/posts/new' },
  },
  {
    icon: <BarChart3 size={40} color="#0F766E" />,
    title: 'Analiza tus resultados',
    desc:  'Cada mes preparamos un informe con lo que funcionó y lo que puedes mejorar.',
    cta:  { label: 'Ver analíticas', href: '/analytics' },
  },
  {
    icon: <CheckCircle2 size={40} color="#1a7a4a" />,
    title: '¡Todo listo!',
    desc:  'Ya sabes cómo funciona NeuroPost. Cuando quieras volver a ver esta guía, puedes hacerlo desde el menú de ayuda.',
  },
];

export function DashboardTutorial() {
  const [open,    setOpen]    = useState(false);
  const [step,    setStep]    = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) { setStep((s) => s + 1); return; }
    dismiss();
  }

  if (!mounted || !open) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,14,12,0.55)',
          zIndex: 9998,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position:   'fixed',
        top:        '50%',
        left:       '50%',
        transform:  'translate(-50%, -50%)',
        zIndex:     9999,
        width:      'min(480px, calc(100vw - 32px))',
        background: 'var(--surface)',
        borderRadius: 20,
        padding:    '36px 32px 28px',
        boxShadow:  '0 24px 64px rgba(0,0,0,0.22)',
        border:     '1px solid var(--border)',
      }}>
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Cerrar tutorial"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--muted)',
            padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={18} />
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex:         i === step ? 2 : 1,
                height:       4,
                borderRadius: 4,
                background:   i <= step ? 'var(--orange)' : 'var(--border)',
                transition:   'flex 0.3s, background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {current.icon}
        </div>

        {/* Text */}
        <h2 style={{
          fontFamily: "'Cabinet Grotesk', sans-serif",
          fontWeight: 900,
          fontSize:   '1.35rem',
          letterSpacing: '-0.02em',
          textAlign:  'center',
          marginBottom: 10,
          color: 'var(--ink)',
        }}>
          {current.title}
        </h2>
        <p style={{
          textAlign: 'center',
          color:     'var(--muted)',
          fontSize:  '0.93rem',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          {current.desc}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          {current.cta && (
            <Link
              href={current.cta.href}
              onClick={dismiss}
              className="btn-primary btn-orange"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, textDecoration: 'none',
              }}
            >
              {current.cta.label} <ArrowRight size={16} />
            </Link>
          )}

          <button
            onClick={next}
            style={{
              background:   isLast ? 'var(--orange)' : 'transparent',
              color:        isLast ? 'white' : 'var(--muted)',
              border:       isLast ? 'none' : 'none',
              borderRadius: 10,
              padding:      '11px 0',
              fontFamily:   "'Cabinet Grotesk', sans-serif",
              fontWeight:   700,
              fontSize:     '0.9rem',
              cursor:       'pointer',
            }}
          >
            {isLast ? '¡Empezar!' : current.cta ? 'Ahora no, continuar →' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </>
  );
}
