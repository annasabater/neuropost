'use client';

import type { VisualStyle } from '@/types';

type FeedPost = {
  id:        string;
  imageUrl?: string;
  caption?:  string;
  published: boolean;
};

const STYLE_COLORS: Record<VisualStyle, { bg: string; accent: string; text: string }> = {
  creative: { bg: '#FF6B9D', accent: '#FF9500', text: '#fff' },
  elegant:  { bg: '#D4C5B0', accent: '#8B7355', text: '#2C2C2C' },
  warm:     { bg: '#D4916A', accent: '#F2CDA0', text: '#fff' },
  dynamic:  { bg: '#1C1C1E', accent: '#FF3B30', text: '#fff' },
};

interface Props {
  posts:       FeedPost[];
  visualStyle: VisualStyle;
  maxItems?:   number;
}

export function InstagramFeedPreview({ posts, visualStyle, maxItems = 9 }: Props) {
  const colors  = STYLE_COLORS[visualStyle];
  const slots   = Array.from({ length: maxItems }, (_, i) => posts[i] ?? null);

  return (
    <div>
      {/* Phone frame */}
      <div style={{
        width:        280,
        borderRadius: 20,
        border:       '2px solid var(--border)',
        overflow:     'hidden',
        background:   'var(--surface)',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.10)',
      }}>
        {/* Mini profile bar */}
        <div style={{
          padding:     '10px 12px',
          borderBottom: '1px solid var(--border)',
          display:     'flex',
          alignItems:  'center',
          gap:         8,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.bg }} />
          <div>
            <div style={{ height: 8, width: 80, borderRadius: 4, background: 'var(--border)' }} />
            <div style={{ height: 6, width: 50, borderRadius: 4, background: 'var(--border)', marginTop: 4 }} />
          </div>
        </div>

        {/* 3×3 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {slots.map((post, i) => (
            <div
              key={post?.id ?? `empty-${i}`}
              title={post?.caption ?? ''}
              style={{
                aspectRatio:    '1',
                position:       'relative',
                overflow:       'hidden',
                background:     post?.imageUrl
                  ? `url(${post.imageUrl}) center/cover`
                  : post && !post.published
                    ? colors.bg
                    : 'var(--border)',
              }}
            >
              {/* Suggested post label */}
              {post && !post.published && (
                <div style={{
                  position:   'absolute',
                  inset:      0,
                  display:    'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${colors.bg}cc`,
                  padding:    4,
                }}>
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color: colors.text, textAlign: 'center', fontFamily: "'Cabinet Grotesk', sans-serif", lineHeight: 1.3 }}>
                    Próxima publicación
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Style label */}
      <p style={{
        marginTop:  8,
        fontSize:   '0.74rem',
        color:      'var(--muted)',
        textAlign:  'center',
        fontFamily: "'Cabinet Grotesk', sans-serif",
      }}>
        Vista previa · Estilo {visualStyle === 'creative' ? 'creativo' : visualStyle === 'elegant' ? 'elegante' : visualStyle === 'warm' ? 'cálido' : 'dinámico'}
      </p>
    </div>
  );
}
