'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, ImagePlus, CheckSquare, Calendar, Palette, ArrowRight, X } from 'lucide-react';

type OnboardingProgress = {
  steps_completed: string[];
  completed: boolean;
};

const CHECKLIST_STEPS = [
  { key: 'instagram',  label: 'Conecta tus redes sociales', desc: 'Vincula Instagram, Facebook o TikTok para empezar a publicar', href: '/settings#redes', icon: Link2 },
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
        onPopoverRender: (popover) => {
          popover.wrapper.classList.add('neuropost-tour-popover');
        },
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
  const firstStep = CHECKLIST_STEPS[0];

  return (
    <>
      <div className="neuropost-tour-shell">
        {completedSteps.length === 0 && !tourStarted && (
          <section className="neuropost-tour-hero">
            <button className="neuropost-tour-close neuropost-tour-close--floating" onClick={() => setDismissed(true)} aria-label="Cerrar bienvenida" title="Cerrar">
              <X size={16} />
            </button>

            <div className="neuropost-tour-hero__left">
              <h1 className="neuropost-tour-title">
                <span>BIENVENIDO A </span>
                <span className="neuropost-tour-title__accent">NEUROPOST</span>
              </h1>
              <p className="neuropost-tour-subtitle">
                Configura tu cuenta en 2 minutos y empieza a publicar automáticamente con un flujo claro, rápido y guiado.
              </p>

              <div className="neuropost-tour-actions">
                <button className="neuropost-tour-btn neuropost-tour-btn--tag-primary" onClick={startTour}>
                  Empezar tour <ArrowRight size={14} />
                </button>
                <button className="neuropost-tour-btn neuropost-tour-btn--tag-secondary" onClick={() => setDismissed(true)}>
                  Saltar por ahora
                </button>
              </div>
            </div>
          </section>
        )}

        {!allDone && (
          <section className="neuropost-tour-hub">
            {firstStep && (
              <div className="neuropost-tour-next" onClick={() => { markStep(firstStep.key); router.push(firstStep.href); }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markStep(firstStep.key); router.push(firstStep.href); } }}>
                <div className="neuropost-tour-next__icon-box">
                  <firstStep.icon size={24} />
                </div>
                <div className="neuropost-tour-next__content">
                  <div className="neuropost-tour-next__title">{firstStep.label}</div>
                  <div className="neuropost-tour-next__desc">{firstStep.desc}</div>
                </div>
                <div className="neuropost-tour-next__cta" aria-hidden="true">
                  <ArrowRight size={18} />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
