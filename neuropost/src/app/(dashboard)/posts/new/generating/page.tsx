'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const f  = "var(--font-barlow), 'Barlow', sans-serif";

const REDIRECT_DELAY = 3200; // ms before redirect

function GeneratingInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const postId       = searchParams.get('id');

  const [visible, setVisible]   = useState(false);
  const [progress, setProgress] = useState(0);

  // Fade in immediately, then start the progress bar
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t1);
  }, []);

  // Animate progress bar over REDIRECT_DELAY
  useEffect(() => {
    if (!visible) return;
    const start  = performance.now();
    let raf: number;
    function tick(now: number) {
      const pct = Math.min(((now - start) / REDIRECT_DELAY) * 100, 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Redirect after delay
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(postId ? `/posts/${postId}` : '/posts');
    }, REDIRECT_DELAY);
    return () => clearTimeout(t);
  }, [router, postId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.35s ease',
    }}>
      <div style={{
        background: '#fff',
        padding: '52px 56px',
        maxWidth: 480, width: 'calc(100vw - 48px)',
        textAlign: 'center',
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'transform 0.35s ease',
      }}>

        {/* Animated dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 10, height: 10,
                background: '#0F766E',
                borderRadius: '50%',
                animation: `npPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        <p style={{
          fontFamily: fc, fontWeight: 900,
          fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: '#111827', lineHeight: 1, marginBottom: 16,
        }}>
          En manos del equipo
        </p>

        <p style={{
          fontFamily: f, fontSize: 15, color: '#6b7280',
          lineHeight: 1.65, marginBottom: 40,
        }}>
          Hemos recibido tu solicitud. Nuestro equipo
          ya está trabajando en ella y recibirás una
          notificación cuando esté lista para revisar.
        </p>

        {/* Progress bar */}
        <div style={{ height: 2, background: '#f3f4f6', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progress}%`,
            background: '#0F766E',
          }} />
        </div>

      </div>

      {/* Keyframes injected inline */}
      <style>{`
        @keyframes npPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

export default function GeneratingPage() {
  return <Suspense><GeneratingInner /></Suspense>;
}
