'use client';

// =============================================================================
// LayoutsGallerySection — Phase 2.C
// =============================================================================
// Wrapper that goes into /brand-kit: header + optional aesthetic nudge banner
// + the gallery grid itself. Kept as a separate client component so the page
// file stays server-rendered.
// =============================================================================

import Link from 'next/link';
import { LayoutsGallery } from './LayoutsGallery';

interface Props {
  brandId:                 string;
  hasAestheticConfigured:  boolean;
}

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export function LayoutsGallerySection({ brandId, hasAestheticConfigured }: Props) {
  return (
    <section
      id="galeria"
      style={{
        display:        'flex',
        flexDirection:  'column',
        gap:            16,
        marginTop:      24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 style={{
          margin:        0,
          fontFamily:    fc,
          fontSize:      28,
          fontWeight:    700,
          letterSpacing: '-0.02em',
          color:         '#111827',
        }}>
          Galeria d&apos;estils
        </h2>
        <p style={{
          margin:     0,
          fontFamily: f,
          fontSize:   14,
          color:      '#6b7280',
          lineHeight: 1.5,
        }}>
          Aquests són els 25 dissenys que NeuroPost pot fer servir per a les teves stories.
          El director d&apos;art escollirà el més adequat a cada moment segons el contingut i
          la teva estètica configurada.
        </p>
      </div>

      {!hasAestheticConfigured && (
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            16,
          padding:        '14px 16px',
          background:     '#fef3c7',
          border:         '1px solid #fde68a',
          borderRadius:   10,
          fontFamily:     f,
          color:          '#92400e',
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ marginRight: 6 }}>⚙️</span>
            Configura primer la teva <strong>estètica</strong> per veure les previews amb el teu estil.
          </div>
          <Link
            href="/brand-kit?edit=estetica"
            style={{
              padding:        '8px 14px',
              fontSize:       12,
              fontWeight:     700,
              fontFamily:     f,
              color:          '#ffffff',
              background:     '#92400e',
              borderRadius:   6,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
            }}
          >
            Anar a Estètica
          </Link>
        </div>
      )}

      <LayoutsGallery brandId={brandId} />
    </section>
  );
}
