'use client';

import Link from 'next/link';
import type { Brand } from '@/types';
import { labelTone, labelLanguage, labelEmojiUse } from '@/lib/brand/labels';

const f = "var(--font-barlow), 'Barlow', sans-serif";

interface Props {
  brand: Brand;
}

export function CommunicationCard({ brand }: Props) {
  // Access extended rule fields safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules       = brand.rules as any;
  const language    = rules?.language  as string | undefined;
  const emojiUse    = rules?.emojiUse  as string | undefined;

  const hashtagCount      = brand.hashtags?.length ?? 0;
  const forbiddenCount    = brand.rules?.forbiddenWords?.length ?? 0;

  const preferencesParts  = [labelLanguage(language), labelEmojiUse(emojiUse)].filter(Boolean);
  const preferencesLine   = preferencesParts.join(' · ');

  return (
    <div style={{
      background:    '#fff',
      border:        '1px solid #d4d4d8',
      borderRadius:  0,
      padding:       16,
      display:       'flex',
      flexDirection: 'column',
      gap:           10,
      height:        '100%',
      boxSizing:     'border-box',
    }}>
      {/* Section label */}
      <p style={{
        fontFamily:    f,
        fontSize:      10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color:         '#6b7280',
        margin:        0,
        fontWeight:    600,
      }}>
        Comunicación
      </p>

      {/* Tone */}
      <p style={{
        fontFamily: f,
        fontSize:   14,
        fontWeight: 700,
        color:      '#111827',
        margin:     0,
      }}>
        {labelTone(brand.tone)}
      </p>

      {/* Preferences line */}
      {preferencesLine && (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#6b7280',
          margin:     0,
        }}>
          {preferencesLine}
        </p>
      )}

      {/* Keywords counter */}
      <p style={{
        fontFamily: f,
        fontSize:   11,
        color:      hashtagCount === 0 ? '#d97706' : '#6b7280',
        margin:     0,
      }}>
        {hashtagCount === 0 ? 'Sin palabras clave' : `${hashtagCount} palabras clave`}
      </p>

      {/* Forbidden words counter */}
      <p style={{
        fontFamily: f,
        fontSize:   11,
        color:      forbiddenCount > 0 ? '#dc2626' : '#d97706',
        margin:     0,
      }}>
        {forbiddenCount > 0
          ? `${forbiddenCount} palabras a evitar`
          : 'Sin palabras a evitar'}
      </p>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Edit link */}
      <Link
        href="/brand-kit?edit=hashtags"
        style={{
          fontFamily:     f,
          fontSize:       12,
          color:          '#0F766E',
          textDecoration: 'none',
          fontWeight:     600,
        }}
      >
        Editar →
      </Link>
    </div>
  );
}
