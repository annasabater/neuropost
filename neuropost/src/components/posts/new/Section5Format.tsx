'use client';

import { Film, Images, ImageIcon } from 'lucide-react';
import type { PostFormat, SourceType } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface FormatOption {
  value:    PostFormat;
  label:    string;
  desc:     string;
  icon:     React.ComponentType<{ size?: number }>;
  disabled: boolean;
}

function buildOptions(sourceType: SourceType, mediaCount: number, allowVideos: boolean, allowStories: boolean): FormatOption[] {
  const hasPhoto = sourceType === 'photos';
  const hasVideo = sourceType === 'video';
  const multi    = hasPhoto && mediaCount > 1;

  if (hasVideo) return [
    { value: 'video', label: 'Vídeo / Reel', desc: 'Publicar como vídeo/reel', icon: Film, disabled: !allowVideos },
  ];

  if (hasPhoto && !multi) return [
    { value: 'image',   label: 'Foto',          desc: 'Publicar como foto individual',     icon: ImageIcon, disabled: false },
    { value: 'video',   label: 'Vídeo / Reel',  desc: 'Generar vídeo a partir de la foto', icon: Film,      disabled: !allowVideos },
    { value: 'story',   label: 'Story',          desc: 'Publicar como story de Instagram',  icon: ImageIcon, disabled: !allowStories },
  ];

  if (hasPhoto && multi) return [
    { value: 'carousel', label: 'Carrusel',      desc: 'Publicar como carrusel',            icon: Images,    disabled: false },
    { value: 'video',    label: 'Vídeo / Reel',  desc: 'Generar vídeo a partir de fotos',   icon: Film,      disabled: !allowVideos },
  ];

  return [
    { value: 'image',   label: 'Foto',          desc: 'La IA genera la foto',              icon: ImageIcon, disabled: false },
    { value: 'carousel',label: 'Carrusel',       desc: 'La IA genera varias fotos',         icon: Images,    disabled: false },
    { value: 'video',   label: 'Vídeo / Reel',  desc: 'La IA genera el vídeo',             icon: Film,      disabled: !allowVideos },
    { value: 'story',   label: 'Story',          desc: 'La IA genera una story',            icon: ImageIcon, disabled: !allowStories },
  ];
}

interface Props {
  sourceType:    SourceType;
  mediaCount:    number;
  value:         PostFormat;
  videoDuration: number;
  extraGenerated:number;
  maxPhotos:     number;
  allowVideos:   boolean;
  allowStories:  boolean;
  onChange:      (format: PostFormat) => void;
  onDuration:    (d: number) => void;
  onExtra:       (n: number) => void;
}

export function Section5Format({
  sourceType, mediaCount, value, videoDuration, extraGenerated,
  maxPhotos, allowVideos, allowStories, onChange, onDuration, onExtra,
}: Props) {
  const options = buildOptions(sourceType, mediaCount, allowVideos, allowStories);
  const isVideo = value === 'video' || value === 'reel';
  const canAddExtra = sourceType === 'photos' && !isVideo && mediaCount < maxPhotos;

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 22,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          5 — Formato de salida
        </h2>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
          ¿Cómo quieres que quede la publicación final?
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1px', background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {options.map((opt) => {
          const active = value === opt.value;
          const Icon   = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              style={{
                padding: '16px 12px', textAlign: 'left', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                background: active ? '#111827' : 'var(--bg)',
                border: 'none', outline: 'none', opacity: opt.disabled ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon size={14} />
                <span style={{
                  fontFamily: fc, fontWeight: 900, fontSize: 14,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: active ? '#fff' : 'var(--text-primary)',
                }}>
                  {opt.label}
                </span>
              </div>
              <div style={{
                fontFamily: f, fontSize: 11,
                color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
              }}>
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>

      {isVideo && (
        <div style={{ padding: '12px 0' }}>
          <label style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
          }}>
            <span>Duración del vídeo</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{videoDuration}s</span>
          </label>
          <input
            type="range" min={5} max={60} step={5} value={videoDuration}
            onChange={(e) => onDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0F766E' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
            <span>5s</span><span>60s</span>
          </div>
        </div>
      )}

      {canAddExtra && (
        <div style={{
          padding: '12px 14px', border: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Fotos adicionales
            </div>
            <div style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>
              ¿Quieres que la IA genere fotos extra además de las tuyas? (máx. {maxPhotos - mediaCount})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => onExtra(Math.max(0, extraGenerated - 1))}
              style={{
                width: 28, height: 28, border: '1px solid var(--border)',
                background: 'var(--bg)', cursor: 'pointer',
                fontFamily: f, fontSize: 16, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>−</button>
            <span style={{ fontFamily: f, fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
              {extraGenerated}
            </span>
            <button type="button" onClick={() => onExtra(Math.min(maxPhotos - mediaCount, extraGenerated + 1))}
              style={{
                width: 28, height: 28, border: '1px solid var(--border)',
                background: 'var(--bg)', cursor: 'pointer',
                fontFamily: f, fontSize: 16, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>+</button>
          </div>
        </div>
      )}
    </section>
  );
}
