'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type PollStatus = 'polling' | 'ready' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS        = 45; // ~3 min

export default function GeneratingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const postId       = searchParams.get('id');
  const count        = Number(searchParams.get('count') ?? 1);

  const [status, setStatus]     = useState<PollStatus>('polling');
  const [polls, setPolls]       = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!postId) { setStatus('failed'); return; }
    try {
      const res = await fetch(`/api/posts/${postId}`);
      if (!res.ok) { setStatus('failed'); return; }
      const { post } = await res.json() as { post: { status: string; image_url?: string; edited_image_url?: string } };

      if (post.status === 'client_review' || post.status === 'approved') {
        setImageUrl(post.edited_image_url ?? post.image_url ?? null);
        setStatus('ready');
      } else if (post.status === 'error' || post.status === 'rejected') {
        setStatus('failed');
      }
    } catch {
      /* keep polling */
    }
  }, [postId]);

  useEffect(() => {
    if (!postId) { setStatus('failed'); return; }
    if (status !== 'polling') return;

    const id = setInterval(() => {
      setPolls((n) => {
        if (n >= MAX_POLLS) { setStatus('timeout'); return n; }
        poll();
        return n + 1;
      });
    }, POLL_INTERVAL_MS);

    poll(); // immediate first check
    return () => clearInterval(id);
  }, [postId, status, poll]);

  const pct = Math.min(Math.round((polls / MAX_POLLS) * 100), 95);

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center',
    }}>
      {status === 'polling' && (
        <>
          <Loader2
            size={48}
            color="#0F766E"
            style={{ animation: 'spin 1s linear infinite', marginBottom: 24 }}
          />
          <h1 style={{
            fontFamily: fc, fontWeight: 900, fontSize: 28,
            textTransform: 'uppercase', letterSpacing: '0.02em',
            color: 'var(--text-primary)', marginBottom: 12,
          }}>
            Generando tu contenido
          </h1>
          <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
            La IA está creando {count > 1 ? `${count} publicaciones` : 'tu publicación'}.
            Esto puede tardar entre 30 segundos y 2 minutos.
          </p>
          <div style={{ width: '100%', height: 4, background: 'var(--border)', position: 'relative', marginBottom: 12 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${pct}%`, background: '#0F766E',
              transition: 'width 4s linear',
            }} />
          </div>
          <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>
            Puedes cerrar esta pestaña — te notificaremos cuando esté listo.
          </p>
        </>
      )}

      {status === 'ready' && (
        <>
          <CheckCircle size={48} color="#0F766E" style={{ marginBottom: 24 }} />
          <h1 style={{
            fontFamily: fc, fontWeight: 900, fontSize: 28,
            textTransform: 'uppercase', letterSpacing: '0.02em',
            color: 'var(--text-primary)', marginBottom: 12,
          }}>
            ¡Listo!
          </h1>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl} alt="Resultado"
              style={{ width: '100%', maxWidth: 360, aspectRatio: '1', objectFit: 'cover', marginBottom: 24 }}
            />
          )}
          <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Tu contenido está listo para revisar.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/posts/${postId}`)}
            style={{
              padding: '14px 32px', background: '#111827', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontFamily: fc, fontWeight: 900, fontSize: 15,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Ver resultado
          </button>
        </>
      )}

      {(status === 'failed' || status === 'timeout') && (
        <>
          <XCircle size={48} color="#ef4444" style={{ marginBottom: 24 }} />
          <h1 style={{
            fontFamily: fc, fontWeight: 900, fontSize: 28,
            textTransform: 'uppercase', letterSpacing: '0.02em',
            color: 'var(--text-primary)', marginBottom: 12,
          }}>
            {status === 'timeout' ? 'Sigue procesando…' : 'Algo fue mal'}
          </h1>
          <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
            {status === 'timeout'
              ? 'La generación está tardando más de lo esperado. Revisa tus posts en unos minutos.'
              : 'No pudimos generar el contenido. Nuestro equipo lo revisará.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => router.push('/posts')}
              style={{
                padding: '12px 24px', background: '#111827', color: '#fff',
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
                padding: '12px 24px', background: 'var(--bg)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontFamily: fc, fontWeight: 900, fontSize: 14,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              Nuevo pedido
            </button>
          </div>
        </>
      )}
    </div>
  );
}
