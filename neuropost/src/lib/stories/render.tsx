// =============================================================================
// Sprint 12 — Story render system
// =============================================================================
// Converts a content_idea + story_template + brand into a 1080×1920 PNG using
// next/og (ImageResponse → satori under the hood).
//
// Fonts are fetched from Google Fonts on first call and cached module-level.
// Each of the 10 system template layouts is a dedicated JSX function.
//
// IMPORTANT: This file uses JSX → must remain .tsx.
// IMPORTANT: Only use display:'flex' layouts (satori constraint).

import { ImageResponse } from 'next/og';
import type { ContentIdea, Brand } from '@/types';
import { resolveFont, type FontDefinition } from './fonts-catalog';

// ─── Font cache ───────────────────────────────────────────────────────────────

// Keyed by FontDefinition.id so renders across brands reuse downloaded TTFs.
const fontCache = new Map<string, ArrayBuffer>();

// Old Android UA makes Google Fonts serve TTF with explicit .ttf URL — satori requires TTF.
// IE6 gets EOT; modern browsers get WOFF2. Android 2.x is the reliable TTF trigger.
async function fetchBunnyFont(googleFamily: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(googleFamily)}:${weight}`;
  const css = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 2.3.6; Nexus S Build/GRK39F) AppleWebKit/533.1' },
  }).then(r => r.text());

  // Android response: src: url(https://fonts.gstatic.com/...ttf) format('truetype')
  const match = css.match(/url\((['"]?)(https:\/\/fonts\.gstatic\.com[^'")\s]+\.ttf[^'")\s]*)\1\)/i);
  if (!match?.[2]) throw new Error(`TTF URL not found on Google Fonts: ${googleFamily}:${weight}`);
  return fetch(match[2]).then(r => r.arrayBuffer());
}

async function loadFonts(displayFont: FontDefinition, bodyFont: FontDefinition) {
  const load = async (font: FontDefinition): Promise<ArrayBuffer> => {
    const cached = fontCache.get(font.id);
    if (cached) return cached;
    const buf = await fetchBunnyFont(font.google_family, font.weight);
    fontCache.set(font.id, buf);
    return buf;
  };
  const [display, body] = await Promise.all([load(displayFont), load(bodyFont)]);
  return { display, body };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;

function clamp(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function splitLines(text: string, maxLines = 10): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, maxLines);
}

// ─── Render context ───────────────────────────────────────────────────────────

interface RenderCtx {
  copy:       string;
  brandName:  string;
  primary:    string;
  secondary:  string;
  logoUrl:    string | null;
  bgImageUrl: string | null;
}

// ─── Layout: centered (Quote Clásica) ─────────────────────────────────────────
// Full brand-color background, large white quote, brand name at bottom.

function LayoutCentered({ copy, brandName, primary, logoUrl }: RenderCtx) {
  const quote = clamp(copy || 'Tu frase aquí', 180);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: primary, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', position: 'relative' }}>
      {/* Optional logo top-right */}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} width={100} height={100} style={{ position: 'absolute', top: 80, right: 80, objectFit: 'contain' }} alt="" />
      )}

      {/* Decorative top-left dot */}
      <div style={{ position: 'absolute', top: 100, left: 80, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex' }} />

      {/* Quote mark */}
      <div style={{ display: 'flex', fontSize: 200, fontFamily: 'Display', fontWeight: 900, color: 'rgba(255,255,255,0.12)', lineHeight: 1, position: 'absolute', top: 60, left: 60 }}>
        "
      </div>

      {/* Quote text */}
      <div style={{ display: 'flex', fontSize: 76, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textAlign: 'center', lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '-0.01em', maxWidth: 920, flexWrap: 'wrap', justifyContent: 'center' }}>
        {quote}
      </div>

      {/* Brand name */}
      <div style={{ position: 'absolute', bottom: 80, display: 'flex', fontSize: 24, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {brandName}
      </div>

      {/* Bottom accent line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.3)', display: 'flex' }} />
    </div>
  );
}

// ─── Layout: minimal (Quote Minimal) ─────────────────────────────────────────
// White background, primary left strip, large dark condensed text.

function LayoutMinimal({ copy, brandName, primary }: RenderCtx) {
  const quote = clamp(copy || 'Tu frase aquí', 200);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#ffffff', position: 'relative' }}>
      {/* Left accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: H, background: primary, display: 'flex' }} />

      {/* Content centered */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 120px' }}>
        <div style={{ display: 'flex', fontSize: 88, fontFamily: 'Display', fontWeight: 900, color: '#111827', textAlign: 'center', lineHeight: 1.0, textTransform: 'uppercase', maxWidth: 860, flexWrap: 'wrap', justifyContent: 'center' }}>
          {quote}
        </div>
      </div>

      {/* Brand name bottom-right */}
      <div style={{ position: 'absolute', bottom: 80, right: 80, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 3, background: primary, display: 'flex' }} />
        <span style={{ fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {brandName}
        </span>
      </div>
    </div>
  );
}

// ─── Layout: table (Horario Semanal) ─────────────────────────────────────────
// White bg, title "HORARIO", rows of day: hours.

function LayoutTable({ copy, brandName, primary, secondary }: RenderCtx) {
  const rows = splitLines(copy, 7);
  const rowH = rows.length > 0 ? Math.min(120, Math.floor(900 / rows.length)) : 120;
  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#ffffff', flexDirection: 'column', padding: '80px 80px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 60 }}>
        <div style={{ display: 'flex', width: 56, height: 6, background: primary, marginBottom: 20 }} />
        <div style={{ display: 'flex', fontSize: 80, fontFamily: 'Display', fontWeight: 900, color: '#111827', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
          NUESTRO
        </div>
        <div style={{ display: 'flex', fontSize: 80, fontFamily: 'Display', fontWeight: 900, color: primary, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
          HORARIO
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
        {rows.length === 0 ? (
          <div style={{ display: 'flex', fontSize: 36, fontFamily: 'Body', color: '#9ca3af' }}>Sin horario</div>
        ) : rows.map((row, i) => {
          const parts = row.split(': ');
          const day   = parts[0] ?? row;
          const hours = parts[1] ?? '';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0', height: rowH, borderBottom: i < rows.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
              <div style={{ display: 'flex', fontSize: Math.min(40, rowH * 0.38), fontFamily: 'Display', fontWeight: 900, color: secondary, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {day}
              </div>
              <div style={{ display: 'flex', fontSize: Math.min(40, rowH * 0.38), fontFamily: 'Body', fontWeight: 700, color: primary }}>
                {hours}
              </div>
            </div>
          );
        })}
      </div>

      {/* Brand name */}
      <div style={{ display: 'flex', marginTop: 40, fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: hero (Horario Destacado) ─────────────────────────────────────────
// Brand-color bg, big "ABIERTO" label, first schedule entry prominent.

function LayoutHero({ copy, brandName, primary }: RenderCtx) {
  const rows  = splitLines(copy, 7);
  const first = rows[0] ?? '';
  const rest  = rows.slice(1);
  const parts = first.split(': ');
  const day   = parts[0] ?? '';
  const hours = parts[1] ?? '';

  return (
    <div style={{ display: 'flex', width: W, height: H, background: primary, flexDirection: 'column', padding: 80, position: 'relative' }}>
      {/* Top label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 80 }}>
        <div style={{ display: 'flex', width: 14, height: 14, borderRadius: '50%', background: '#ffffff' }} />
        <span style={{ fontSize: 28, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
          HORARIO
        </span>
      </div>

      {/* Featured day */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 52, fontFamily: 'Display', fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          {day || 'LUNES'}
        </div>
        <div style={{ display: 'flex', fontSize: 140, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
          {hours || '9-20h'}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', width: '100%', height: 2, background: 'rgba(255,255,255,0.2)', margin: '60px 0' }} />

        {/* Rest of week compact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rest.slice(0, 5).map((row, i) => {
            const p = row.split(': ');
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 34, fontFamily: 'Display', fontWeight: 900, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' }}>
                  {p[0]}
                </span>
                <span style={{ fontSize: 34, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>
                  {p[1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brand name */}
      <div style={{ position: 'absolute', bottom: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: banner (Promo Banner) ────────────────────────────────────────────
// Top 58% white with title + desc, bottom 42% brand color with brand name.

function LayoutBanner({ copy, brandName, primary, secondary }: RenderCtx) {
  const rows  = splitLines(copy, 6);
  const title = clamp(rows[0] ?? 'PROMO', 60);
  const desc  = rows.slice(1).join(' — ');

  return (
    <div style={{ display: 'flex', width: W, height: H, flexDirection: 'column' }}>
      {/* Top section */}
      <div style={{ display: 'flex', flex: '0 0 1100px', background: '#ffffff', flexDirection: 'column', justifyContent: 'flex-end', padding: '80px 80px 60px' }}>
        <div style={{ display: 'flex', fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 24 }}>
          NUEVA OFERTA
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontFamily: 'Display', fontWeight: 900, color: '#111827', lineHeight: 0.9, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {title}
        </div>
        {desc && (
          <div style={{ display: 'flex', fontSize: 36, fontFamily: 'Body', fontWeight: 700, color: '#6b7280', lineHeight: 1.4, marginTop: 32, maxWidth: 880, flexWrap: 'wrap' }}>
            {clamp(desc, 160)}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div style={{ display: 'flex', flex: 1, background: primary, flexDirection: 'column', justifyContent: 'space-between', padding: '60px 80px 80px' }}>
        <div style={{ display: 'flex', width: 60, height: 4, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {brandName}
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ¡APROVÉCHALO AHORA →
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Layout: urgent (Promo Urgente) ───────────────────────────────────────────
// Dark background, brand-color top strip, big title in brand color.

function LayoutUrgent({ copy, brandName, primary }: RenderCtx) {
  const rows  = splitLines(copy, 4);
  const title = clamp(rows[0] ?? 'OFERTA LIMITADA', 80);
  const desc  = rows.slice(1).join('\n');

  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#0f172a', flexDirection: 'column', position: 'relative' }}>
      {/* Top accent strip */}
      <div style={{ display: 'flex', width: W, height: 12, background: primary }} />

      {/* Content */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '60px 80px' }}>
        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{ display: 'flex', width: 40, height: 4, background: primary }} />
          <span style={{ fontSize: 24, fontFamily: 'Body', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            OFERTA ESPECIAL
          </span>
        </div>

        {/* Big title */}
        <div style={{ display: 'flex', fontSize: 96, fontFamily: 'Display', fontWeight: 900, color: primary, lineHeight: 0.9, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {title}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', width: 80, height: 4, background: 'rgba(255,255,255,0.15)', margin: '56px 0' }} />

        {/* Description lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {splitLines(desc, 3).map((l, i) => (
            <div key={i} style={{ display: 'flex', fontSize: 40, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
              {clamp(l, 80)}
            </div>
          ))}
        </div>
      </div>

      {/* Brand name */}
      <div style={{ position: 'absolute', bottom: 80, left: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {brandName}
      </div>

      {/* Bottom strip */}
      <div style={{ display: 'flex', width: W, height: 8, background: primary }} />
    </div>
  );
}

// ─── Layout: stat (Dato Destacado) ────────────────────────────────────────────
// Giant stat number + context label, white background.

function LayoutStat({ copy, brandName, primary, secondary }: RenderCtx) {
  const rows  = splitLines(copy, 3);
  const stat  = clamp(rows[0] ?? '—', 20);
  const label = clamp(rows[1] ?? '', 80);

  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#ffffff', flexDirection: 'column', padding: '80px', position: 'relative' }}>
      {/* Top label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto' }}>
        <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: primary }} />
        <span style={{ fontSize: 24, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {brandName}
        </span>
      </div>

      {/* Center: giant stat */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 0 }}>
        {/* Thin accent line */}
        <div style={{ display: 'flex', width: 80, height: 6, background: primary, marginBottom: 48 }} />

        {/* The number / stat */}
        <div style={{ display: 'flex', fontSize: 200, fontFamily: 'Display', fontWeight: 900, color: primary, lineHeight: 0.85, letterSpacing: '-0.04em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
          {stat}
        </div>

        {/* Context */}
        {label && (
          <div style={{ display: 'flex', fontSize: 52, fontFamily: 'Body', fontWeight: 700, color: secondary, lineHeight: 1.2, marginTop: 32, maxWidth: 860, flexWrap: 'wrap' }}>
            {label}
          </div>
        )}
      </div>

      {/* Bottom decoration */}
      <div style={{ display: 'flex', width: '100%', height: 2, background: '#e5e7eb', marginBottom: 48 }} />
    </div>
  );
}

// ─── Layout: tagline (Lema de Marca) ─────────────────────────────────────────
// Brand-color bg, big centered condensed text, horizontal divider.

function LayoutTagline({ copy, brandName, primary }: RenderCtx) {
  const text = clamp(copy || 'Nuestro lema', 160);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: primary, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', position: 'relative' }}>
      {/* Top decoration */}
      <div style={{ position: 'absolute', top: 80, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', width: 60, height: 2, background: 'rgba(255,255,255,0.3)' }} />
        <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ display: 'flex', width: 60, height: 2, background: 'rgba(255,255,255,0.3)' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', fontSize: 100, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textAlign: 'center', lineHeight: 1.0, textTransform: 'uppercase', letterSpacing: '-0.01em', maxWidth: 920, flexWrap: 'wrap', justifyContent: 'center' }}>
        {text}
      </div>

      {/* Horizontal divider */}
      <div style={{ display: 'flex', width: 120, height: 4, background: 'rgba(255,255,255,0.4)', marginTop: 60 }} />

      {/* Brand name */}
      <div style={{ position: 'absolute', bottom: 80, display: 'flex', fontSize: 24, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: overlay (Foto con Overlay) ───────────────────────────────────────
// Brand-color top, dark gradient bottom, text anchored at bottom.

function LayoutOverlay({ copy, brandName, primary, secondary }: RenderCtx) {
  const text = clamp(copy || '', 200);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: primary, flexDirection: 'column', position: 'relative' }}>
      {/* Dark overlay gradient - bottom half */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 900, background: 'rgba(0,0,0,0.72)', display: 'flex' }} />

      {/* Soft texture - top decorative dots */}
      <div style={{ position: 'absolute', top: 120, left: 80, display: 'flex', gap: 24 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ display: 'flex', width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
        ))}
      </div>

      {/* Brand name top */}
      <div style={{ position: 'absolute', top: 80, right: 80, display: 'flex', fontSize: 24, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {brandName}
      </div>

      {/* Bottom text content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 80px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', width: 48, height: 4, background: primary }} />
        <div style={{ display: 'flex', fontSize: 60, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {text}
        </div>
      </div>
    </div>
  );
}

// ─── Layout: flexible (Contenido Libre) ───────────────────────────────────────
// Light bg, primary left border, readable paragraph text.

function LayoutFlexible({ copy, brandName, primary, secondary }: RenderCtx) {
  const allLines = splitLines(copy, 12);
  const text     = clamp(copy || '', 400);

  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#f8fafc', position: 'relative', flexDirection: 'column' }}>
      {/* Left accent border */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: H, background: primary, display: 'flex' }} />

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '80px 80px 0 100px' }}>
        <div style={{ display: 'flex', fontSize: 26, fontFamily: 'Body', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
          {brandName}
        </div>
        <div style={{ display: 'flex', width: '100%', height: 1, background: '#e2e8f0' }} />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '40px 80px 40px 100px' }}>
        {allLines.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {allLines.slice(0, 8).map((line, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 46, fontFamily: i === 0 ? 'Display' : 'Body', fontWeight: i === 0 ? 900 : 700, color: i === 0 ? '#111827' : secondary, lineHeight: 1.3, flexWrap: 'wrap' }}>
                {clamp(line, 60)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 56, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af' }}>
            Sin contenido
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', padding: '0 80px 80px 100px', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: primary }} />
          <span style={{ fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {brandName}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Layout: photo_overlay (any story type with inspiration photo bg) ─────────
// Full-bleed background image + dark overlay + big white text.
// Simulates a "blurred background" via heavy rgba overlay (satori has no blur).

function LayoutPhotoOverlay({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
  const text = clamp(copy || '', 200);
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {/* Heavy overlay — dims + "blurs" perception */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: 'rgba(0,0,0,0.58)', display: 'flex' }} />
      {/* Brand accent top strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 10, background: primary, display: 'flex' }} />
      {/* Content */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px' }}>
        <div style={{ display: 'flex', width: 56, height: 6, background: primary, marginBottom: 44 }} />
        <div style={{ display: 'flex', fontSize: 82, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {text}
        </div>
      </div>
      {/* Brand name bottom */}
      <div style={{ position: 'absolute', bottom: 80, left: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
      {/* Bottom accent strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: W, height: 6, background: primary, display: 'flex' }} />
    </div>
  );
}

// ─── Layout: photo_schedule (schedule/horario with inspiration photo bg) ──────
// Full-bleed background image + very dark overlay + white schedule table.

function LayoutPhotoSchedule({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
  const rows = splitLines(copy, 7);
  const rowH = rows.length > 0 ? Math.min(120, Math.floor(700 / rows.length)) : 120;
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {/* Very dark overlay — schedule text must be fully readable */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: 'rgba(0,0,0,0.72)', display: 'flex' }} />
      {/* Brand accent top strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 10, background: primary, display: 'flex' }} />
      {/* Content */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', padding: '80px 80px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 56 }}>
          <div style={{ display: 'flex', width: 56, height: 6, background: primary, marginBottom: 20 }} />
          <div style={{ display: 'flex', fontSize: 80, fontFamily: 'Display', fontWeight: 900, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
            NUESTRO
          </div>
          <div style={{ display: 'flex', fontSize: 80, fontFamily: 'Display', fontWeight: 900, color: primary, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
            HORARIO
          </div>
        </div>
        {/* Schedule rows */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
          {rows.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 36, fontFamily: 'Body', color: 'rgba(255,255,255,0.5)' }}>Sin horario</div>
          ) : rows.map((row, i) => {
            const parts = row.split(': ');
            const day   = parts[0] ?? row;
            const hours = parts[1] ?? '';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: rowH, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                <div style={{ display: 'flex', fontSize: Math.min(40, rowH * 0.38), fontFamily: 'Display', fontWeight: 900, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {day}
                </div>
                <div style={{ display: 'flex', fontSize: Math.min(40, rowH * 0.38), fontFamily: 'Body', fontWeight: 700, color: primary }}>
                  {hours}
                </div>
              </div>
            );
          })}
        </div>
        {/* Brand name */}
        <div style={{ display: 'flex', marginTop: 40, fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {brandName}
        </div>
      </div>
      {/* Bottom accent strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: W, height: 6, background: primary, display: 'flex' }} />
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function buildJSX(layout: string, ctx: RenderCtx): React.ReactElement {
  switch (layout) {
    case 'centered':       return <LayoutCentered      {...ctx} />;
    case 'minimal':        return <LayoutMinimal        {...ctx} />;
    case 'table':          return <LayoutTable          {...ctx} />;
    case 'hero':           return <LayoutHero           {...ctx} />;
    case 'banner':         return <LayoutBanner         {...ctx} />;
    case 'urgent':         return <LayoutUrgent         {...ctx} />;
    case 'stat':           return <LayoutStat           {...ctx} />;
    case 'tagline':        return <LayoutTagline        {...ctx} />;
    case 'overlay':        return <LayoutOverlay        {...ctx} />;
    case 'flexible':       return <LayoutFlexible       {...ctx} />;
    case 'photo_overlay':  return <LayoutPhotoOverlay   {...ctx} />;
    case 'photo_schedule': return <LayoutPhotoSchedule  {...ctx} />;
    default:               return <LayoutCentered       {...ctx} />;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function renderStory(params: {
  layoutName:  string;
  idea:        ContentIdea;
  brand:       Brand;
  bgImageUrl?: string | null;
}): Promise<ArrayBuffer> {
  const { idea, brand } = params;

  // Resolve fonts from brand.fonts (falls back to defaults if null or unknown ids).
  const brandFonts = (brand as unknown as { fonts?: { heading?: string; body?: string } | null }).fonts ?? null;
  const displayFont = resolveFont(brandFonts?.heading, 'display');
  const bodyFont    = resolveFont(brandFonts?.body,    'body');
  const fonts  = await loadFonts(displayFont, bodyFont);

  const colors = (brand.colors as Record<string, string> | null) ?? {};

  // Pre-fetch background image as base64 data URI (satori requires data URIs for reliable cross-origin images)
  let bgImageUrl: string | null = params.bgImageUrl ?? null;
  if (!bgImageUrl && (idea as unknown as Record<string, unknown>).suggested_asset_url) {
    const rawUrl = (idea as unknown as Record<string, unknown>).suggested_asset_url as string;
    try {
      const imgBuf = await fetch(rawUrl).then(r => r.arrayBuffer());
      const mime   = rawUrl.match(/\.png(\?|$)/i) ? 'image/png' : 'image/jpeg';
      bgImageUrl   = `data:${mime};base64,${Buffer.from(imgBuf).toString('base64')}`;
    } catch {
      bgImageUrl = null;
    }
  }

  // Choose photo layout when a background image is available
  let effectiveLayout = params.layoutName;
  if (bgImageUrl) {
    effectiveLayout = (params.layoutName === 'table' || params.layoutName === 'hero')
      ? 'photo_schedule'
      : 'photo_overlay';
  }

  const ctx: RenderCtx = {
    copy:       clamp(idea.copy_draft ?? '', 300),
    brandName:  brand.name,
    primary:    colors['primary']  ?? '#0F766E',
    secondary:  colors['secondary'] ?? '#374151',
    logoUrl:    (brand as unknown as Record<string, unknown>).logo_url as string | null ?? null,
    bgImageUrl,
  };

  const jsx = buildJSX(effectiveLayout, ctx);

  const response = new ImageResponse(jsx, {
    width:  W,
    height: H,
    fonts: [
      { name: 'Display', data: fonts.display, weight: displayFont.weight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, style: 'normal' },
      { name: 'Body',    data: fonts.body,    weight: bodyFont.weight    as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, style: 'normal' },
    ],
  });

  return response.arrayBuffer();
}
