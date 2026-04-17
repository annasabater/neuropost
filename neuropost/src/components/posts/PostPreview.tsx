'use client';

import type { Platform, PostFormat } from '@/types';

interface Props {
  imageUrl:  string | null;
  videoUrl?: string | null;
  caption:   string;
  hashtags:  string[];
  platform:  Platform;
  format:    PostFormat;
  brandName?: string;
  videoDuration?: number | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export function PostPreview({ imageUrl, videoUrl, caption, hashtags, platform, format, brandName = 'Tu negocio', videoDuration }: Props) {
  const isVideo = format === 'video' || format === 'reel';
  const aspectClass = isVideo ? 'preview-aspect-reel' : format === 'carousel' ? 'preview-aspect-sq' : 'preview-aspect-sq';

  return (
    <div className={`post-preview-card post-preview-${platform}`}>
      {/* Header */}
      <div className="post-preview-header">
        <div className="post-preview-avatar">
          {brandName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="post-preview-name">{brandName}</p>
          <p className="post-preview-meta">{PLATFORM_LABEL[platform] ?? platform}</p>
        </div>
        <span className="post-preview-platform-badge">{platform}</span>
      </div>

      {/* Media */}
      <div className={`post-preview-image ${aspectClass}`}>
        {isVideo && videoUrl ? (
          <video
            src={videoUrl}
            controls
            poster={imageUrl ?? undefined}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Vista previa" />
        ) : (
          <div className="post-preview-placeholder">
            <span>{isVideo ? 'Sin vídeo' : 'Sin imagen'}</span>
          </div>
        )}
        {format === 'video' && <span className="preview-format-label">▶ Vídeo{videoDuration ? ` ${videoDuration}s` : ''}</span>}
        {format === 'reel' && <span className="preview-format-label">▶ Reel{videoDuration ? ` ${videoDuration}s` : ''}</span>}
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
