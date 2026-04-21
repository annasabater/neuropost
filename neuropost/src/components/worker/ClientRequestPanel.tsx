'use client';

import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { CockpitPost, Inspiration } from './cockpit-types';

const FORMAT_LABELS: Record<string, string> = {
  post: 'Post', story: 'Story', reel: 'Reel', carrusel: 'Carrusel',
};

const STATUS_COLORS: Record<string, string> = {
  preparing:     '#f59e0b',
  pending:       '#3b82f6',
  client_review: '#0d9488',
  published:     '#10b981',
  rejected:      '#ef4444',
};

type Props = {
  post: CockpitPost;
  inspirations?: Inspiration[];
};

export function ClientRequestPanel({ post, inspirations = [] }: Props) {
  let description = post.caption ?? '(sin descripción)';
  let sourceFiles: string[] = [];

  try {
    const meta = JSON.parse(post.ai_explanation ?? '{}') as Record<string, unknown>;
    const perImg = meta.per_image as Array<{ note?: string }> | undefined;
    description =
      perImg?.[0]?.note?.trim() ||
      String(meta.global_description ?? meta.client_notes ?? post.caption ?? '(sin descripción)');
    sourceFiles = Array.isArray(meta.source_files) ? (meta.source_files as string[]) : [];
  } catch { /* use defaults */ }

  const primaryImage = sourceFiles[0] ?? post.image_url;
  const extraImages = sourceFiles.slice(1);

  const label = (text: string) => (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: fc,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 4,
    }}>
      {text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          background: '#0F766E', color: '#fff', fontSize: 10, fontWeight: 700,
          fontFamily: fc, letterSpacing: '0.08em', padding: '3px 8px',
          textTransform: 'uppercase' as const,
        }}>
          {FORMAT_LABELS[post.format ?? ''] ?? post.format ?? 'Post'}
        </span>
        <span style={{
          background: STATUS_COLORS[post.status] ?? '#6b7280', color: '#fff',
          fontSize: 10, fontWeight: 700, fontFamily: fc, letterSpacing: '0.08em',
          padding: '3px 8px', textTransform: 'uppercase' as const,
        }}>
          {post.status}
        </span>
      </div>

      {/* Primary image */}
      {primaryImage && (
        <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primaryImage}
            alt="Imagen del cliente"
            style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 260 }}
          />
        </div>
      )}

      {/* Extra images */}
      {extraImages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {extraImages.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`ref-${i}`}
              style={{ width: 72, height: 72, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }}
            />
          ))}
        </div>
      )}

      {/* Inspirations */}
      {inspirations.length > 0 && (
        <div>
          {label('REFERENCIAS')}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {inspirations.map((ins) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={ins.id}
                src={ins.thumbnail_url}
                alt="inspiración"
                style={{ width: 64, height: 64, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        {label('DESCRIPCIÓN DEL CLIENTE')}
        <p style={{
          fontSize: 13, color: '#111', fontFamily: f, lineHeight: 1.6, margin: 0,
          background: '#f9fafb', padding: 12, border: '1px solid #e5e7eb',
        }}>
          {description}
        </p>
      </div>

      {/* Caption */}
      {post.caption && (
        <div>
          {label('CAPTION')}
          <p style={{ fontSize: 12, color: '#374151', fontFamily: f, lineHeight: 1.5, margin: 0 }}>
            {post.caption}
          </p>
        </div>
      )}

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {post.hashtags.slice(0, 15).map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, color: '#0F766E', fontFamily: f,
              background: '#ecfdf5', padding: '2px 6px', border: '1px solid #a7f3d0',
            }}>
              #{tag.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
