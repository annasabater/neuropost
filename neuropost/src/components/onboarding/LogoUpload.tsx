'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { createBrowserClient } from '@/lib/supabase';

const ACCENT = '#0F766E';
const INK    = '#111827';
const MUTED  = '#6b7280';
const BORDER = '#d4d4d8';
const FONT   = "var(--font-barlow), 'Barlow', sans-serif";
const FONT_C = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  logoUrl:    string;
  colors:     string[];
  onLogoUrl:  (url: string) => void;
  onColors:   (colors: string[]) => void;
}

export default function LogoUpload({ logoUrl, colors, onLogoUrl, onColors }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const extractColors = useCallback(async (imgUrl: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ColorThief = ((await import('colorthief')) as any).default;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = imgUrl;
      });
      const ct = new ColorThief();
      const palette: [number, number, number][] = ct.getPalette(img, 5);
      const hex = palette.map(([r, g, b]: [number, number, number]) =>
        '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''),
      );
      onColors(hex);
    } catch {
      // color extraction is best-effort
    }
  }, [onColors]);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Solo se admiten imágenes.'); return; }
    if (file.size > 5 * 1024 * 1024)    { setError('El archivo supera 5 MB.'); return; }
    setError('');
    setUploading(true);
    try {
      const supabase  = createBrowserClient();
      const user      = await supabase.auth.getUser();
      const uid       = user.data.user?.id ?? 'anon';
      const ext       = file.name.substring(file.name.lastIndexOf('.'));
      const path      = `logos/${uid}-${Date.now()}${ext}`;
      const buf       = await file.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('media').upload(path, buf, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      onLogoUrl(data.publicUrl);
      await extractColors(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el logo.');
    } finally {
      setUploading(false);
    }
  }, [extractColors, onLogoUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (accepted) => { if (accepted[0]) void upload(accepted[0]); },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        style={{
          border: `1.5px dashed ${isDragActive ? ACCENT : BORDER}`,
          background: isDragActive ? 'rgba(15,118,110,0.04)' : '#fff',
          padding: '24px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input {...getInputProps()} />

        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ width: 56, height: 56, objectFit: 'contain', background: '#f9f9f9', border: `1px solid ${BORDER}`, flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, background: '#f3f4f6', border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="0"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        <div>
          <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.88rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
            {uploading ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Arrastra tu logo aquí'}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '0.74rem', color: MUTED, lineHeight: 1.4 }}>
            PNG, JPG o SVG · máx. 5 MB
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: '#dc2626' }}>{error}</div>
      )}

      {/* Extracted color swatches */}
      {colors.length > 0 && (
        <div>
          <div style={{ fontFamily: FONT, fontSize: '0.72rem', color: MUTED, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Colores detectados
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {colors.map((c, i) => (
              <div key={i} title={c} style={{ width: 32, height: 32, background: c, border: `1px solid ${BORDER}`, cursor: 'default' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
