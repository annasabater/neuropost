'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, Bell } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function ConfirmationPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const count        = Number(searchParams.get('count') ?? 1);

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center',
    }}>
      <CheckCircle size={48} color="#0F766E" style={{ marginBottom: 24 }} />

      <h1 style={{
        fontFamily: fc, fontWeight: 900, fontSize: 32,
        textTransform: 'uppercase', letterSpacing: '0.02em',
        color: 'var(--text-primary)', marginBottom: 12,
      }}>
        Solicitud enviada
      </h1>

      <p style={{ fontFamily: f, fontSize: 15, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.6 }}>
        {count > 1
          ? `Hemos recibido tus ${count} publicaciones.`
          : 'Hemos recibido tu solicitud.'}
        {' '}Nuestro equipo la revisará y te notificaremos cuando esté lista.
      </p>

      {/* What happens next */}
      <div style={{
        width: '100%', border: '1px solid var(--border)',
        background: 'var(--bg)', marginBottom: 40,
      }}>
        {[
          { icon: Clock, title: 'Revisión por el equipo', desc: 'Un especialista revisará tu solicitud y generará el contenido.' },
          { icon: Bell,  title: 'Notificación',           desc: 'Recibirás una notificación cuando el contenido esté listo para revisar.' },
          { icon: CheckCircle, title: 'Aprobación final', desc: 'Podrás aprobar, solicitar cambios o programar la publicación.' },
        ].map(({ icon: Icon, title, desc }, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            padding: '16px 20px',
            borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: 36, height: 36, background: 'rgba(15,118,110,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={18} color="#0F766E" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: f, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                {title}
              </div>
              <div style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => router.push('/posts')}
          style={{
            padding: '14px 28px', background: '#111827', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontFamily: fc, fontWeight: 900, fontSize: 14,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          Ver mis posts
        </button>
        <button
          type="button"
          onClick={() => router.push('/posts/new')}
          style={{
            padding: '14px 28px', background: 'var(--bg)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: fc, fontWeight: 900, fontSize: 14,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          Nuevo pedido
        </button>
      </div>
    </div>
  );
}
