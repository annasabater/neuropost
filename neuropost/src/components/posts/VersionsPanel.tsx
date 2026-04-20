'use client';

import { useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { PostVersion } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  versions:         PostVersion[];
  currentCaption?:  string | null;
  currentImageUrl?: string | null;
  onRevert?:        (version: PostVersion) => Promise<void>;
}

function MediaThumb({ url, alt, dim = 80 }: { url: string; alt: string; dim?: number }) {
  if (/\.(mp4|mov|webm|avi)(\?|$)/i.test(url)) {
    return <video src={url} muted style={{ width: dim, height: dim, objectFit: 'cover', display: 'block' }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} style={{ width: dim, height: dim, objectFit: 'cover', display: 'block' }} />;
}

function MediaPreview({ url }: { url: string }) {
  if (/\.(mp4|mov|webm|avi)(\?|$)/i.test(url)) {
    return (
      <video
        src={url}
        controls
        style={{ width: '100%', maxHeight: 540, objectFit: 'contain', display: 'block' }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      style={{ width: '100%', maxHeight: 540, objectFit: 'contain', display: 'block' }}
    />
  );
}

export function VersionsPanel({ versions, currentCaption, currentImageUrl, onRevert }: Props) {
  const [open,        setOpen]        = useState(true);
  // null = current proposal; 0..n-1 = archived versions (0 = oldest / "original")
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [reverting,   setReverting]   = useState<number | null>(null);

  if (!versions || versions.length === 0) return null;

  const isCurrentSelected = selectedIdx === null;
  const selected          = selectedIdx !== null ? versions[selectedIdx] : null;

  const displayCaption  = selected ? selected.caption   : currentCaption;
  const displayImage    = selected ? selected.image_url : currentImageUrl;

  async function handleRevert(v: PostVersion, idx: number) {
    if (!onRevert) return;
    setReverting(idx);
    try { await onRevert(v); }
    finally { setReverting(null); }
  }

  const versionLabel = (i: number) => {
    if (i === 0) return 'Original';
    return `v${i + 1}`;
  };

  // Total count: archived versions + current proposal = versions.length + 1
  const totalCount = versions.length + 1;

  return (
    <div style={{ border: '1px solid var(--border)', overflow: 'hidden', marginTop: 16 }}>

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: '#111827', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={15} style={{ color: '#0D9488' }} />
          <span style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ffffff' }}>
            Historial de versiones
          </span>
          <span style={{
            padding: '2px 8px', background: 'rgba(255,255,255,0.1)',
            fontFamily: f, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
          }}>
            {totalCount}
          </span>
        </span>
        {open
          ? <ChevronUp size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
          : <ChevronDown size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
        }
      </button>

      {open && (
        <>
          {/* ── Filmstrip ── */}
          <div style={{
            display: 'flex', gap: 4, padding: '12px', background: '#0f172a',
            overflowX: 'auto', scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.15) transparent',
          }}>
            {/* Archived versions — oldest (Original) first */}
            {versions.map((v, i) => {
              const isSelected = selectedIdx === i;
              const label      = versionLabel(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  title={label}
                  style={{
                    position: 'relative', width: 88, height: 88, flexShrink: 0,
                    padding: 0, border: 'none', cursor: 'pointer',
                    outline: isSelected ? '2px solid #0D9488' : '2px solid transparent',
                    outlineOffset: 0, background: '#1e293b', overflow: 'hidden',
                  }}
                >
                  {v.image_url ? (
                    <MediaThumb url={v.image_url} alt={label} dim={88} />
                  ) : (
                    <div style={{
                      width: 88, height: 88, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 8,
                      background: isSelected ? 'rgba(13,148,136,0.25)' : '#1e293b',
                    }}>
                      <p style={{
                        fontFamily: f, fontSize: 9, color: isSelected ? '#5eead4' : 'rgba(255,255,255,0.4)',
                        textAlign: 'center', lineHeight: 1.4, overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                      }}>
                        {v.caption.slice(0, 80)}
                      </p>
                    </div>
                  )}
                  {/* Dim overlay for non-selected */}
                  {!isSelected && v.image_url && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                  )}
                  {/* Label bar */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 5px',
                    background: isSelected ? '#0D9488' : 'rgba(0,0,0,0.7)',
                    fontFamily: fc, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.07em', color: '#fff', textAlign: 'center',
                  }}>
                    {label}
                  </div>
                </button>
              );
            })}

            {/* Current proposal — always last */}
            {(() => {
              const isSelected = selectedIdx === null;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIdx(null)}
                  title="Propuesta actual"
                  style={{
                    position: 'relative', width: 88, height: 88, flexShrink: 0,
                    padding: 0, border: 'none', cursor: 'pointer',
                    outline: isSelected ? '2px solid #ffffff' : '2px solid transparent',
                    outlineOffset: 0, background: '#1e293b', overflow: 'hidden',
                  }}
                >
                  {currentImageUrl ? (
                    <MediaThumb url={currentImageUrl} alt="Actual" dim={88} />
                  ) : (
                    <div style={{
                      width: 88, height: 88, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 8,
                      background: isSelected ? 'rgba(255,255,255,0.12)' : '#1e293b',
                    }}>
                      <p style={{
                        fontFamily: f, fontSize: 9, color: isSelected ? '#fff' : 'rgba(255,255,255,0.4)',
                        textAlign: 'center', lineHeight: 1.4, overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                      }}>
                        {currentCaption?.slice(0, 80)}
                      </p>
                    </div>
                  )}
                  {!isSelected && currentImageUrl && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
                  )}
                  {/* Label bar */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 5px',
                    background: isSelected ? '#ffffff' : 'rgba(0,0,0,0.7)',
                    fontFamily: fc, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.07em', color: isSelected ? '#111827' : '#fff', textAlign: 'center',
                  }}>
                    Actual
                  </div>
                </button>
              );
            })()}
          </div>

          {/* ── Large media preview ── */}
          {displayImage && (
            <div style={{ background: '#000', borderTop: '1px solid var(--border)' }}>
              <MediaPreview url={displayImage} />
            </div>
          )}

          {/* ── Caption + details + restore ── */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            {/* Version label row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{
                fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isCurrentSelected ? '#0D9488' : 'var(--text-tertiary)',
              }}>
                {isCurrentSelected
                  ? '● Propuesta actual'
                  : selectedIdx === 0
                    ? '○ Versión original'
                    : `○ Versión ${(selectedIdx ?? 0) + 1}`}
              </span>
              {selected?.savedAt && (
                <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {new Date(selected.savedAt).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            {/* Caption text */}
            {displayCaption && (
              <p style={{
                fontFamily: f, fontSize: 14, color: 'var(--text-primary)',
                lineHeight: 1.75, whiteSpace: 'pre-wrap',
                marginBottom: selected?.hashtags?.length ? 14 : 0,
              }}>
                {displayCaption}
              </p>
            )}

            {/* Hashtags */}
            {selected?.hashtags && selected.hashtags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {selected.hashtags.map((h) => (
                  <span key={h} style={{
                    padding: '3px 10px', background: 'var(--accent-soft)',
                    color: 'var(--accent)', fontFamily: f, fontSize: 12, fontWeight: 500,
                  }}>
                    #{h.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}

            {/* Restore button — only for archived versions */}
            {!isCurrentSelected && onRevert && selected && (
              <button
                type="button"
                disabled={reverting === selectedIdx}
                onClick={() => handleRevert(selected, selectedIdx!)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', background: 'transparent',
                  border: '1px solid var(--border-dark)',
                  fontFamily: f, fontSize: 12, fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: reverting === selectedIdx ? 'wait' : 'pointer',
                  opacity: reverting === selectedIdx ? 0.6 : 1,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#0D9488';
                  e.currentTarget.style.color = '#0D9488';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-dark)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <RotateCcw size={13} />
                {reverting === selectedIdx ? 'Restaurando…' : 'Restaurar esta versión'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
