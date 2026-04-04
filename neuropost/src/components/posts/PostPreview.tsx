'use client';

import type { Platform, PostFormat } from '@/types';

interface Props {
  imageUrl:  string | null;
  caption:   string;
  hashtags:  string[];
  platform:  Platform;
  format:    PostFormat;
  brandName?: string;
}

export function PostPreview({ imageUrl, caption, hashtags, platform, format, brandName = 'Tu negocio' }: Props) {
  const isInstagram = platform === 'instagram';
  const aspectClass = format === 'reel' ? 'preview-aspect-reel' : format === 'carousel' ? 'preview-aspect-sq' : 'preview-aspect-sq';

  return (
    <div className={`post-preview-card post-preview-${platform}`}>
      {/* Header */}
      <div className="post-preview-header">
        <div className="post-preview-avatar">
          {brandName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="post-preview-name">{brandName}</p>
          {isInstagram && <p className="post-preview-meta">Instagram</p>}
          {!isInstagram && <p className="post-preview-meta">Facebook</p>}
        </div>
        <span className="post-preview-platform-badge">{platform}</span>
      </div>

      {/* Image */}
      <div className={`post-preview-image ${aspectClass}`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Vista previa" />
        ) : (
          <div className="post-preview-placeholder">
            <span>Sin imagen</span>
          </div>
        )}
        {format === 'reel' && <span className="preview-format-label">▶ Reel</span>}
        {format === 'carousel' && <span className="preview-format-label">⊞ Carrusel</span>}
      </div>

      {/* Actions row (fake) */}
      <div className="post-preview-actions">
        <span>♡</span>
        <span>○</span>
        <span>↗</span>
        {isInstagram && <span style={{ marginLeft: 'auto' }}>🔖</span>}
      </div>

      {/* Caption */}
      {caption && (
        <div className="post-preview-caption">
          <strong>{brandName}</strong>{' '}
          <span>{caption}</span>
          {hashtags.length > 0 && (
            <p className="post-preview-hashtags">
              {hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
