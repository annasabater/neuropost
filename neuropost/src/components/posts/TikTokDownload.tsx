'use client';

import { useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  videoUrl: string;
  caption?: string | null;
  hashtags?: string[];
  postId: string;
}

/**
 * TikTok manual publish assistant.
 * Shows download button + copyable caption + "I published it" checkbox.
 */
export function TikTokDownload({ videoUrl, caption, hashtags, postId }: Props) {
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const fullCaption = [
    caption ?? '',
    ...(hashtags?.map(h => `#${h.replace(/^#/, '')}`) ?? []),
  ].filter(Boolean).join(' ');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCopied(true);
      toast.success('Caption copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function handleMarkPublished() {
    setSaving(true);
    try {
      // Mark the TikTok publication as manually published
      await fetch(`/api/posts/${postId}/publications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'tiktok', manual_publish: true }),
      });
      setPublished(true);
      toast.success('Marcado como publicado en TikTok');
    } catch {
      toast.error('Error al marcar');
    }
    setSaving(false);
  }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎵</span>
        <span style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TikTok</span>
        {published && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#065f46', fontWeight: 600, fontFamily: f }}>Publicado</span>}
      </div>

      <div style={{ padding: '18px' }}>
        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          Descarga el vídeo y súbelo manualmente a TikTok. Copia el caption optimizado para TikTok.
        </p>

        {/* Download button */}
        <a
          href={videoUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 20px', background: '#111827', color: '#ffffff',
            textDecoration: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
          }}
        >
          <Download size={15} /> Descargar vídeo para TikTok
        </a>

        {/* Caption copy */}
        {fullCaption && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                Caption para TikTok
              </span>
              <button type="button" onClick={handleCopy} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', background: 'none', border: '1px solid var(--border)',
                cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
              }}>
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
            <div style={{
              padding: '10px 14px', background: 'var(--bg-1)', border: '1px solid var(--border)',
              fontFamily: f, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)',
              maxHeight: 100, overflowY: 'auto',
            }}>
              {fullCaption}
            </div>
          </div>
        )}

        {/* Mark as published */}
        {!published && (
          <button
            type="button"
            onClick={handleMarkPublished}
            disabled={saving}
            style={{
              width: '100%', padding: '10px', border: '1px solid var(--border)',
              background: 'var(--bg)', cursor: 'pointer',
              fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Guardando...' : 'Ya lo he publicado en TikTok'}
          </button>
        )}
      </div>
    </div>
  );
}
