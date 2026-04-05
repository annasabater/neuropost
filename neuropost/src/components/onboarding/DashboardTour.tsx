'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingProgress = {
  steps_completed: string[];
  completed: boolean;
};

const CHECKLIST_STEPS = [
  { key: 'instagram',   label: 'Conecta tu Instagram',     href: '/settings/connections' },
  { key: 'first_post',  label: 'Sube tu primera foto',     href: '/posts/new' },
  { key: 'approved',    label: 'Aprueba tu primer post',   href: '/posts' },
  { key: 'calendar',    label: 'Revisa tu calendario',     href: '/calendar' },
  { key: 'brand_kit',   label: 'Personaliza tu Brand Kit', href: '/brand' },
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
    const d = await res.json();
    if (d.progress) setProgress(d.progress);
  }

  async function completeTour() {
    const res = await fetch('/api/onboarding/progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
          {
            popover: {
              title: '👋 ¡Bienvenido a NeuroPost!',
              description: 'En 2 minutos te enseñamos cómo funciona todo. Tu equipo ya está preparando tu primer contenido.',
            },
          },
          {
            element: '[data-tour="dashboard-metrics"]',
            popover: {
              title: '📊 Tu resumen',
              description: 'Aquí verás el resumen de tus redes sociales. Posts publicados, engagement y lo que tienes pendiente de revisar.',
            },
          },
          {
            element: '[data-tour="new-post-btn"]',
            popover: {
              title: '✦ Nuevo post',
              description: 'Cuando quieras subir una foto o pedir contenido, usa este botón. El equipo lo prepara y te lo envía para que lo apruebes.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="nav-calendar"]',
            popover: {
              title: '📅 El calendario',
              description: 'Aquí ves todo lo que está programado para publicar. Puedes arrastar los posts para cambiar el orden.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="nav-mi-feed"]',
            popover: {
              title: '📱 Mi feed',
              description: '¡La parte más chula! Puedes ver exactamente cómo quedará tu Instagram con los próximos posts.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="nav-chat"]',
            popover: {
              title: '💬 Chat con tu equipo',
              description: 'Tienes acceso directo a tu gestor de redes. Escríbele si necesitas algo o tienes alguna duda.',
              side: 'right',
            },
          },
          {
            popover: {
              title: '🎉 ¡Ya sabes cómo funciona!',
              description: 'Tu equipo ya está trabajando en tu primer contenido. Te avisaremos cuando esté listo para revisar.',
              onNextClick: () => {
                completeTour();
                driverObj.destroy();
              },
            },
          },
        ],
        onDestroyStarted: () => {
          completeTour();
          driverObj.destroy();
        },
      });

      driverObj.drive();
    } catch {
      // driver.js not available, just mark as done
      completeTour();
    }
  }

  // Don't show if completed or dismissed or no data yet
  if (!progress || progress.completed || dismissed) return null;

  const completedSteps = progress.steps_completed ?? [];
  const doneCount = CHECKLIST_STEPS.filter((s) => completedSteps.includes(s.key)).length;
  const allDone = doneCount === CHECKLIST_STEPS.length;

  return (
    <>
      {/* Tour prompt — only if tour not done yet and no steps completed */}
      {completedSteps.length === 0 && !tourStarted && (
        <div style={{
          background: 'linear-gradient(135deg, #fff8f5 0%, #fff 100%)',
          border: '2px solid #ff6b35',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{ fontSize: 48 }}>👋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>¡Bienvenido a NeuroPost!</div>
            <div style={{ color: '#6b7280', fontSize: 14 }}>Te enseñamos cómo funciona todo en 2 minutos.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDismissed(true)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
              Saltar
            </button>
            <button onClick={startTour} style={{ padding: '8px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Empezar tour →
            </button>
          </div>
        </div>
      )}

      {/* Checklist card */}
      {!allDone && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Primeros pasos</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{doneCount}/{CHECKLIST_STEPS.length} completados</div>
            </div>
            <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#f3f4f6', borderRadius: 4, height: 6, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ background: '#ff6b35', height: '100%', borderRadius: 4, width: `${(doneCount / CHECKLIST_STEPS.length) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHECKLIST_STEPS.map((step) => {
              const done = completedSteps.includes(step.key);
              return (
                <div
                  key={step.key}
                  onClick={() => { if (!done) { markStep(step.key); router.push(step.href); } }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                    borderRadius: 8, cursor: done ? 'default' : 'pointer',
                    background: done ? '#f9fafb' : '#fff',
                    border: '1px solid #f3f4f6',
                    opacity: done ? 0.7 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.background = '#fff8f5'; }}
                  onMouseLeave={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#d1fae5' : '#f3f4f6',
                    border: `2px solid ${done ? '#6ee7b7' : '#e5e7eb'}`,
                    fontSize: 12,
                  }}>
                    {done ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: done ? 400 : 600, color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
                    {step.label}
                  </span>
                  {!done && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ff6b35', fontWeight: 600 }}>→</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
