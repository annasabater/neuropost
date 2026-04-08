'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, ImagePlus, CheckSquare, Calendar, Palette, ArrowRight, Check, X } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type OnboardingProgress = {
  steps_completed: string[];
  completed: boolean;
};

const CHECKLIST_STEPS = [
  { key: 'instagram',  label: 'Conecta tu Instagram',     desc: 'Sincroniza tu cuenta para empezar a publicar', href: '/settings/connections', icon: Link2 },
  { key: 'first_post', label: 'Crea tu primer post',      desc: 'Sube una foto y deja que la IA haga el resto',  href: '/posts/new',            icon: ImagePlus },
  { key: 'approved',   label: 'Aprueba tu primer post',   desc: 'Revisa el contenido y apruébalo con un clic',   href: '/posts',                icon: CheckSquare },
  { key: 'calendar',   label: 'Revisa tu calendario',     desc: 'Ve qué está programado para esta semana',        href: '/calendar',             icon: Calendar },
  { key: 'brand_kit',  label: 'Personaliza tu Brand Kit', desc: 'Define colores, tono y estilo de tu marca',      href: '/brand',                icon: Palette },
];

export default function DashboardTour() {
  const router = useRouter();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/progress').then((r) => r.json()).then((d) => {
      if (d.progress) setProgress(d.progress);
    });
  }, []);

  async function markStep(step: string) {
    const res = await fetch('/api/onboarding/progress', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
    const d = await res.json();
    if (d.progress) setProgress(d.progress);
  }

  async function completeTour() {
    const res = await fetch('/api/onboarding/progress', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    const d = await res.json();
    if (d.progress) setProgress(d.progress);
  }

  async function startTour() {
    if (tourStarted) return;
    setTourStarted(true);
    try {
      const { driver } = await import('driver.js');
      await import('driver.js/dist/driver.css');
      const driverObj = driver({
        showProgress: true,
        steps: [
          { popover: { title: 'Bienvenido a NeuroPost', description: 'En 2 minutos te enseñamos cómo funciona. Tu equipo ya está preparando tu primer contenido.' } },
          { element: '[data-tour="dashboard-metrics"]', popover: { title: 'Tu resumen', description: 'Posts publicados, engagement y pendientes de revisar.' } },
          { element: '[data-tour="new-post-btn"]', popover: { title: 'Nuevo post', description: 'Sube una foto o pide contenido. El equipo lo prepara.', side: 'bottom' } },
          { element: '[data-tour="nav-calendar"]', popover: { title: 'Calendario', description: 'Todo lo programado. Arrastra posts para reordenar.', side: 'right' } },
          { element: '[data-tour="nav-mi-feed"]', popover: { title: 'Mi feed', description: 'Ve cómo quedará tu Instagram con los próximos posts.', side: 'right' } },
          { element: '[data-tour="nav-chat"]', popover: { title: 'Chat con tu equipo', description: 'Acceso directo a tu gestor de redes.', side: 'right' } },
          { popover: { title: 'Listo', description: 'Tu equipo ya trabaja en tu primer contenido.', onNextClick: () => { completeTour(); driverObj.destroy(); } } },
        ],
        onDestroyStarted: () => { completeTour(); driverObj.destroy(); },
      });
      driverObj.drive();
    } catch { completeTour(); }
  }

  if (!progress || progress.completed || dismissed) return null;

  const completedSteps = progress.steps_completed ?? [];
  const doneCount = CHECKLIST_STEPS.filter((s) => completedSteps.includes(s.key)).length;
  const allDone = doneCount === CHECKLIST_STEPS.length;
  const pct = Math.round((doneCount / CHECKLIST_STEPS.length) * 100);
  const nextStep = CHECKLIST_STEPS.find((s) => !completedSteps.includes(s.key));

  return (
    <>
      {/* ── Welcome banner — only if no steps done ── */}
      {completedSteps.length === 0 && !tourStarted && (
        <div style={{
          background: '#ffffff', border: '1px solid #d4d4d8',
          padding: '28px 32px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: '#111827', letterSpacing: '0.01em', marginBottom: 4 }}>
              Bienvenido a NeuroPost
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Configura tu cuenta en 2 minutos y empieza a publicar automáticamente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setDismissed(true)} style={{
              padding: '8px 16px', border: '1px solid #d4d4d8', background: '#ffffff',
              cursor: 'pointer', fontFamily: f, fontSize: 12, fontWeight: 500, color: '#6b7280',
            }}>
              Saltar
            </button>
            <button onClick={startTour} style={{
              padding: '8px 20px', background: '#111827', color: '#ffffff', border: 'none',
              cursor: 'pointer', fontFamily: fc, fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Empezar tour <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Activation hub ── */}
      {!allDone && (
        <div style={{ background: '#ffffff', border: '1px solid #d4d4d8', marginBottom: 32 }}>
          {/* Header with progress */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#111827' }}>
                  Configura tu cuenta
                </p>
                <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {doneCount} de {CHECKLIST_STEPS.length} completados
                </p>
              </div>
              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 80, height: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#0F766E', transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: pct === 100 ? '#0F766E' : '#9ca3af' }}>{pct}%</span>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} title="Cerrar" aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Next step highlight */}
          {nextStep && (
            <div
              onClick={() => { markStep(nextStep.key); router.push(nextStep.href); }}
              style={{
                padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#f0fdf4', cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F766E', flexShrink: 0 }}>
                <nextStep.icon size={16} color="#ffffff" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0F766E', marginBottom: 2 }}>
                  Siguiente paso
                </p>
                <p style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>{nextStep.label}</p>
                <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 1 }}>{nextStep.desc}</p>
              </div>
              <ArrowRight size={16} style={{ color: '#0F766E', flexShrink: 0 }} />
            </div>
          )}

          {/* Steps list */}
          {CHECKLIST_STEPS.map((step, i) => {
            const done = completedSteps.includes(step.key);
            const isNext = nextStep?.key === step.key;
            if (isNext) return null; // already shown above
            const Icon = step.icon;
            return (
              <div
                key={step.key}
                onClick={() => { if (!done) { markStep(step.key); router.push(step.href); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 24px',
                  borderBottom: i < CHECKLIST_STEPS.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: done ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  opacity: done ? 0.6 : 1,
                }}
              >
                <div style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#f0fdf4' : '#f3f4f6', flexShrink: 0,
                }}>
                  {done ? <Check size={14} color="#0F766E" /> : <Icon size={14} color="#9ca3af" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontFamily: f, fontSize: 13, fontWeight: done ? 400 : 600,
                    color: done ? '#9ca3af' : '#111827',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {step.label}
                  </p>
                  {!done && <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{step.desc}</p>}
                </div>
                {!done && <ArrowRight size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
