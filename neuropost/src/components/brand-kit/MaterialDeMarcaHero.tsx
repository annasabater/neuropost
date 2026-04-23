'use client';

import { useRouter }               from 'next/navigation';
import { formatDistanceToNow }     from 'date-fns';
import { es }                      from 'date-fns/locale';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  itemCount:     number;
  lastUpdatedAt: string | null;
  brandId:       string;
}

function FileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        fill="white"
        fillOpacity="0.9"
      />
      <path d="M14 2v6h6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
      <path d="M8 13h8M8 17h5" stroke="rgba(15,118,110,0.6)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MaterialDeMarcaHero({ itemCount, lastUpdatedAt, brandId: _brandId }: Props) {
  const router = useRouter();

  const relativeDate = lastUpdatedAt
    ? formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true, locale: es })
    : null;

  return (
    <div style={{
      background:   '#111827',
      padding:      '20px 24px',
      display:      'flex',
      alignItems:   'center',
      gap:          16,
      borderRadius: 0,
    }}>
      {/* Icon square */}
      <div style={{
        width:          48,
        height:         48,
        background:     '#0F766E',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        borderRadius:   0,
      }}>
        <FileIcon />
      </div>

      {/* Center text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily:    fc,
          fontWeight:    700,
          fontSize:      14,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color:         '#fff',
          margin:        0,
        }}>
          Material de marca
        </p>
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      'rgba(255,255,255,0.6)',
          margin:     '2px 0 0',
        }}>
          {itemCount === 1 ? '1 elemento' : `${itemCount} elementos`}
        </p>
        {relativeDate && (
          <p style={{
            fontFamily: f,
            fontSize:   11,
            color:      'rgba(255,255,255,0.4)',
            margin:     '2px 0 0',
          }}>
            Actualizado {relativeDate}
          </p>
        )}
      </div>

      {/* CTA button */}
      <button
        onClick={() => router.push('/brand/material')}
        style={{
          fontFamily:   f,
          fontSize:     13,
          fontWeight:   600,
          background:   'transparent',
          color:        '#fff',
          border:       '1px solid rgba(255,255,255,0.3)',
          borderRadius: 0,
          padding:      '8px 18px',
          cursor:       'pointer',
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}
      >
        Gestionar →
      </button>
    </div>
  );
}
