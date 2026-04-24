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
import { getLayoutById } from './layouts-catalog';
import { getRendererOrDefault } from './layouts-render-registry';

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

export type OverlayIntensity = 'none' | 'subtle' | 'medium' | 'strong';

export interface RenderCtxProp {
  type:    'chat' | 'arrow' | 'tag';
  content: unknown;
}

export interface RenderCtx {
  copy:             string;
  brandName:        string;
  primary:          string;
  secondary:        string;
  logoUrl:          string | null;
  bgImageUrl:       string | null;
  overlayIntensity: OverlayIntensity;
  /** Reserved for Phase 3 (creative director). Not consumed in Phase 2.B. */
  prop?:            RenderCtxProp;
  /** Reserved for Phase 3. Not consumed in Phase 2.B. */
  badge?:           string;
}

const OVERLAY_ALPHA: Record<OverlayIntensity, number> = {
  none:   0,
  subtle: 0.3,
  medium: 0.55,
  strong: 0.75,
};

// ─── Layout: centered (Quote Clásica) ─────────────────────────────────────────
// Full brand-color background, large white quote, brand name at bottom.

export function LayoutCentered({ copy, brandName, primary, logoUrl }: RenderCtx) {
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

export function LayoutMinimal({ copy, brandName, primary }: RenderCtx) {
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

export function LayoutTable({ copy, brandName, primary, secondary }: RenderCtx) {
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

export function LayoutHero({ copy, brandName, primary }: RenderCtx) {
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

export function LayoutBanner({ copy, brandName, primary, secondary }: RenderCtx) {
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

export function LayoutUrgent({ copy, brandName, primary }: RenderCtx) {
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

export function LayoutStat({ copy, brandName, primary, secondary }: RenderCtx) {
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

export function LayoutTagline({ copy, brandName, primary }: RenderCtx) {
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

export function LayoutOverlay({ copy, brandName, primary, secondary }: RenderCtx) {
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

export function LayoutFlexible({ copy, brandName, primary, secondary }: RenderCtx) {
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

export function LayoutPhotoOverlay({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
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

export function LayoutPhotoSchedule({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
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

// ─── Layout: photo_fullbleed_clean (Phase 2.B) ────────────────────────────────
// Foto a sangre sin texto ni overlay. Logo opcional en esquina inferior derecha.

export function LayoutPhotoFullbleedClean({ bgImageUrl, logoUrl }: RenderCtx) {
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} width={72} height={72} style={{ position: 'absolute', bottom: 60, right: 60, objectFit: 'contain', opacity: 0.85 }} alt="" />
      )}
    </div>
  );
}

// ─── Layout: photo_fullbleed_with_prop (Phase 2.B) ────────────────────────────
// Esqueleto. Sin ctx.prop, renderiza igual que photo_fullbleed_clean.
// Phase 3 pintará props (chat simulado, flechas manuscritas, tags).

export function LayoutPhotoFullbleedWithProp(ctx: RenderCtx) {
  // Phase 2.B: prop rendering not implemented — falls through to clean variant.
  return LayoutPhotoFullbleedClean(ctx);
}

// ─── Layout: photo_split_top (Phase 2.B) ──────────────────────────────────────
// Foto 60% arriba, bloque primary 40% abajo con copy en Display.

export function LayoutPhotoSplitTop({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
  const text     = clamp(copy || '', 180);
  const photoH   = Math.floor(H * 0.6);
  const blockH   = H - photoH;
  return (
    <div style={{ display: 'flex', width: W, height: H, flexDirection: 'column', background: '#111111' }}>
      {/* Photo top */}
      <div style={{ display: 'flex', width: W, height: photoH, position: 'relative', overflow: 'hidden' }}>
        {bgImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: photoH, objectFit: 'cover' }} alt="" />
        )}
      </div>
      {/* Brand block bottom */}
      <div style={{ display: 'flex', width: W, height: blockH, background: primary, flexDirection: 'column', justifyContent: 'center', padding: '60px 80px', position: 'relative' }}>
        <div style={{ display: 'flex', width: 56, height: 6, background: 'rgba(255,255,255,0.55)', marginBottom: 28 }} />
        <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {text}
        </div>
        <div style={{ position: 'absolute', bottom: 48, left: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {brandName}
        </div>
      </div>
    </div>
  );
}

// ─── Layout: photo_split_bottom (Phase 2.B) ───────────────────────────────────
// Bloque primary 40% arriba + foto 60% abajo.

export function LayoutPhotoSplitBottom({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
  const text   = clamp(copy || '', 180);
  const blockH = Math.floor(H * 0.4);
  const photoH = H - blockH;
  return (
    <div style={{ display: 'flex', width: W, height: H, flexDirection: 'column', background: '#111111' }}>
      {/* Brand block top */}
      <div style={{ display: 'flex', width: W, height: blockH, background: primary, flexDirection: 'column', justifyContent: 'center', padding: '60px 80px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 48, left: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {brandName}
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
          {text}
        </div>
      </div>
      {/* Photo bottom */}
      <div style={{ display: 'flex', width: W, height: photoH, position: 'relative', overflow: 'hidden' }}>
        {bgImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: photoH, objectFit: 'cover' }} alt="" />
        )}
      </div>
    </div>
  );
}

// ─── Layout: photo_corner_text (Phase 2.B) ────────────────────────────────────
// Foto a sangre con overlay según brand, copy en Display en esquina inferior izq.

export function LayoutPhotoCornerText({ copy, brandName, primary, bgImageUrl, overlayIntensity, badge }: RenderCtx) {
  const text  = clamp(copy || '', 120);
  const alpha = OVERLAY_ALPHA[overlayIntensity];
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {alpha > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: `rgba(0,0,0,${alpha})`, display: 'flex' }} />
      )}
      {/* Badge top-right */}
      {badge && (
        <div style={{ position: 'absolute', top: 60, right: 60, display: 'flex', padding: '12px 24px', background: primary, fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: '#ffffff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {clamp(badge, 24)}
        </div>
      )}
      {/* Corner text bottom-left */}
      {text && (
        <div style={{ position: 'absolute', bottom: 60, left: 60, display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
          <div style={{ display: 'flex', width: 48, height: 4, background: primary, marginBottom: 28 }} />
          <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, textTransform: 'uppercase', flexWrap: 'wrap' }}>
            {text}
          </div>
        </div>
      )}
      {/* Brand name bottom-right */}
      <div style={{ position: 'absolute', bottom: 60, right: 60, display: 'flex', fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: photo_grid_schedule (Phase 2.B) ──────────────────────────────────
// Foto + overlay fuerte (ignora brand setting) + grid DL-DG blanco semitransparente.
// Los 7 días siempre se pintan; valores vienen de copy "DL: 9-21" líneas, si falta → "—".

export function LayoutPhotoGridSchedule({ copy, brandName, primary, bgImageUrl }: RenderCtx) {
  const DAYS = ['DL', 'DT', 'DC', 'DJ', 'DV', 'DS', 'DG'];
  const rows = splitLines(copy, 14);
  const map  = new Map<string, string>();
  for (const row of rows) {
    const parts = row.split(':');
    if (parts.length >= 2) {
      const key = (parts[0] ?? '').trim().slice(0, 2).toUpperCase();
      const val = parts.slice(1).join(':').trim();
      if (key && val) map.set(key, val);
    }
  }
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {/* Forced strong overlay — legibility */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: 'rgba(0,0,0,0.75)', display: 'flex' }} />
      {/* Brand accent top */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 10, background: primary, display: 'flex' }} />
      {/* Content */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', padding: '100px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 56 }}>
          <div style={{ display: 'flex', width: 56, height: 6, background: primary, marginBottom: 20 }} />
          <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
            HORARI
          </div>
        </div>
        {/* Grid card */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.92)', padding: '36px 44px', borderRadius: 4 }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0', borderBottom: i < DAYS.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ display: 'flex', fontSize: 34, fontFamily: 'Display', fontWeight: 900, color: '#111827', letterSpacing: '0.04em' }}>
                {d}
              </div>
              <div style={{ display: 'flex', fontSize: 30, fontFamily: 'Body', fontWeight: 700, color: map.has(d) ? primary : '#9ca3af' }}>
                {map.get(d) ?? '—'}
              </div>
            </div>
          ))}
        </div>
        {/* Brand name */}
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 40, fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {brandName}
        </div>
      </div>
    </div>
  );
}

// ─── Layout: editorial_large_title (Phase 2.B) ────────────────────────────────
// Foto con overlay sutil/medio, título editorial gigante arriba, subtítulo debajo.

export function LayoutEditorialLargeTitle({ copy, brandName, primary, bgImageUrl, overlayIntensity }: RenderCtx) {
  const rows     = splitLines(copy, 4);
  const title    = clamp(rows[0] ?? '', 80);
  const subtitle = clamp(rows.slice(1).join(' — '), 140);
  const alpha    = OVERLAY_ALPHA[overlayIntensity];
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {alpha > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: `rgba(0,0,0,${alpha})`, display: 'flex' }} />
      )}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', padding: '120px 80px 100px' }}>
        {title && (
          <div style={{ display: 'flex', fontSize: 128, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 0.92, letterSpacing: '-0.03em', textTransform: 'uppercase', maxWidth: 920, flexWrap: 'wrap' }}>
            {title}
          </div>
        )}
        {subtitle && (
          <div style={{ display: 'flex', fontSize: 32, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginTop: 48, maxWidth: 820, flexWrap: 'wrap' }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 80, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', width: 40, height: 3, background: primary }} />
        <span style={{ fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {brandName}
        </span>
      </div>
    </div>
  );
}

// ─── Layout: minimal_color_block (Phase 2.B) ──────────────────────────────────
// Bloque plano en primary con tipografía condensada enorme centrada.

export function LayoutMinimalColorBlock({ copy, brandName, primary }: RenderCtx) {
  const text = clamp(copy || '', 140);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: primary, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', position: 'relative' }}>
      <div style={{ display: 'flex', fontSize: 120, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textAlign: 'center', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.03em', maxWidth: 920, flexWrap: 'wrap', justifyContent: 'center' }}>
        {text}
      </div>
      <div style={{ position: 'absolute', bottom: 80, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: stat_highlight_clean (Phase 2.B) ─────────────────────────────────
// Fondo blanco, número gigante en primary, contexto debajo, accent line.

export function LayoutStatHighlightClean({ copy, brandName, primary, secondary }: RenderCtx) {
  const rows  = splitLines(copy, 3);
  const stat  = clamp(rows[0] ?? '—', 20);
  const label = clamp(rows.slice(1).join(' '), 140);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#fafafa', flexDirection: 'column', padding: '100px 80px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
        <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: primary }} />
        <span style={{ fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: '#6b7280', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {brandName}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 240, fontFamily: 'Display', fontWeight: 900, color: primary, lineHeight: 0.82, letterSpacing: '-0.05em', flexWrap: 'wrap' }}>
          {stat}
        </div>
        <div style={{ display: 'flex', width: 120, height: 2, background: primary, margin: '40px 0' }} />
        {label && (
          <div style={{ display: 'flex', fontSize: 44, fontFamily: 'Body', fontWeight: 700, color: secondary, lineHeight: 1.3, maxWidth: 820, flexWrap: 'wrap' }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout: quote_editorial_serif (Phase 2.B) ────────────────────────────────
// Cita grande centrada en Display serif sobre fondo crema.

export function LayoutQuoteEditorialSerif({ copy, brandName, primary }: RenderCtx) {
  const quote = clamp(copy || '', 220);
  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#faf7f2', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '140px 100px', position: 'relative' }}>
      <div style={{ display: 'flex', fontSize: 180, fontFamily: 'Display', fontWeight: 900, color: 'rgba(17,24,39,0.1)', lineHeight: 1, position: 'absolute', top: 100, left: 100 }}>
        "
      </div>
      <div style={{ display: 'flex', fontSize: 64, fontFamily: 'Display', fontWeight: 900, color: '#1f2937', textAlign: 'center', lineHeight: 1.18, letterSpacing: '-0.01em', maxWidth: 860, flexWrap: 'wrap', justifyContent: 'center' }}>
        {quote}
      </div>
      <div style={{ display: 'flex', width: 60, height: 2, background: primary, marginTop: 72 }} />
      <div style={{ position: 'absolute', bottom: 100, display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: '#6b7280', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Layout: product_hero_cta (Phase 2.B) ─────────────────────────────────────
// Foto full-bleed sutil, título arriba, CTA en banda inferior con primary.

export function LayoutProductHeroCta({ copy, brandName, primary, bgImageUrl, overlayIntensity }: RenderCtx) {
  const rows = splitLines(copy, 4);
  const title    = clamp(rows[0] ?? '', 60);
  const subtitle = clamp(rows[1] ?? '', 100);
  const cta      = clamp(rows[2] ?? 'Descobreix-ho', 40);
  const alpha    = overlayIntensity === 'none' ? 0 : Math.min(OVERLAY_ALPHA[overlayIntensity], 0.3);
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#111111' }}>
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
      )}
      {alpha > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: `rgba(0,0,0,${alpha})`, display: 'flex' }} />
      )}
      {title && (
        <div style={{ position: 'absolute', top: 120, left: 80, right: 80, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 96, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.02em', maxWidth: 920, flexWrap: 'wrap' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ display: 'flex', fontSize: 30, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, marginTop: 28, maxWidth: 820, flexWrap: 'wrap' }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
      {/* CTA band */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: W, display: 'flex', flexDirection: 'column', background: primary, padding: '40px 80px 48px' }}>
        <div style={{ display: 'flex', fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          {brandName}
        </div>
        <div style={{ display: 'flex', fontSize: 48, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          {cta} →
        </div>
      </div>
    </div>
  );
}

// ─── Layout: story_numbered_series (Phase 2.B) ────────────────────────────────
// FAQ-style: número grande, título en Display, body en Body. Imagen opcional arriba.

export function LayoutStoryNumberedSeries({ copy, brandName, primary, secondary, bgImageUrl }: RenderCtx) {
  const rows   = splitLines(copy, 10);
  // rows[0]: "01" or similar. rows[1]: title. rows[2+]: body lines.
  const number = clamp(rows[0] ?? '01', 4);
  const title  = clamp(rows[1] ?? '', 80);
  const body   = rows.slice(2).join('\n');
  const illoH  = bgImageUrl ? Math.floor(H / 3) : 0;

  return (
    <div style={{ display: 'flex', width: W, height: H, background: '#ffffff', flexDirection: 'column', position: 'relative' }}>
      {bgImageUrl && (
        <div style={{ display: 'flex', width: W, height: illoH, position: 'relative', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bgImageUrl} style={{ position: 'absolute', top: 0, left: 0, width: W, height: illoH, objectFit: 'cover' }} alt="" />
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 32 }}>
          <span style={{ fontSize: 140, fontFamily: 'Display', fontWeight: 900, color: primary, lineHeight: 0.85, letterSpacing: '-0.04em' }}>
            {number}
          </span>
          <div style={{ display: 'flex', width: 40, height: 4, background: primary }} />
        </div>
        {title && (
          <div style={{ display: 'flex', fontSize: 64, fontFamily: 'Display', fontWeight: 900, color: '#111827', lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 32, maxWidth: 900, flexWrap: 'wrap' }}>
            {title}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {splitLines(body, 5).map((line, i) => (
            <div key={i} style={{ display: 'flex', fontSize: 36, fontFamily: 'Body', fontWeight: 700, color: secondary, lineHeight: 1.35, flexWrap: 'wrap' }}>
              {clamp(line, 110)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: primary }} />
          <span style={{ fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {brandName}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Layout: compare_split (Phase 2.B) ────────────────────────────────────────
// División vertical 50/50 en primary/secondary.
// Formato copy esperado: "Título A | Título B" / "Detalle A | Detalle B".

export function LayoutCompareSplit({ copy, brandName, primary, secondary }: RenderCtx) {
  const rows   = splitLines(copy, 4);
  const titles = (rows[0] ?? '').split('|').map(s => s.trim());
  const detail = (rows[1] ?? '').split('|').map(s => s.trim());
  const titleA = clamp(titles[0] ?? 'Opció A', 40);
  const titleB = clamp(titles[1] ?? 'Opció B', 40);
  const descA  = clamp(detail[0] ?? '', 90);
  const descB  = clamp(detail[1] ?? '', 90);
  const halfW  = W / 2;

  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative' }}>
      {/* Left column */}
      <div style={{ display: 'flex', width: halfW, height: H, background: primary, flexDirection: 'column', justifyContent: 'center', padding: '80px 60px' }}>
        <div style={{ display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 24 }}>
          A
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.02em', flexWrap: 'wrap' }}>
          {titleA}
        </div>
        {descA && (
          <div style={{ display: 'flex', fontSize: 30, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginTop: 32, flexWrap: 'wrap' }}>
            {descA}
          </div>
        )}
      </div>
      {/* Right column */}
      <div style={{ display: 'flex', width: halfW, height: H, background: secondary, flexDirection: 'column', justifyContent: 'center', padding: '80px 60px' }}>
        <div style={{ display: 'flex', fontSize: 22, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 24 }}>
          B
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontFamily: 'Display', fontWeight: 900, color: '#ffffff', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.02em', flexWrap: 'wrap' }}>
          {titleB}
        </div>
        {descB && (
          <div style={{ display: 'flex', fontSize: 30, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginTop: 32, flexWrap: 'wrap' }}>
            {descB}
          </div>
        )}
      </div>
      {/* Center VS */}
      <div style={{ position: 'absolute', top: H / 2 - 40, left: W / 2 - 40, width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '50%' }}>
        <span style={{ fontSize: 28, fontFamily: 'Display', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
          VS
        </span>
      </div>
      {/* Brand name bottom */}
      <div style={{ position: 'absolute', bottom: 48, left: 0, width: W, display: 'flex', justifyContent: 'center', fontSize: 20, fontFamily: 'Body', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {brandName}
      </div>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function buildJSX(layoutName: string, ctx: RenderCtx): React.ReactElement {
  const layout = getLayoutById(layoutName) ?? getLayoutById('centered');
  const renderer = getRendererOrDefault(layoutName, layout);
  return renderer(ctx);
}

function resolveLayoutForRender(requestedLayout: string, hasImage: boolean): string {
  const layout = getLayoutById(requestedLayout);
  if (!layout) return 'flexible';

  if (hasImage) {
    if (layout.supportsImage) return requestedLayout;
    if (layout.supportsSchedule) return 'photo_schedule';
    return 'photo_overlay';
  }
  if (layout.requiresImage) return 'flexible';
  return requestedLayout;
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

  // Choose effective layout based on catalog metadata + image availability.
  const effectiveLayout = resolveLayoutForRender(params.layoutName, Boolean(bgImageUrl));

  const brandOverlayRaw = (brand as unknown as Record<string, unknown>).overlay_intensity;
  const overlayIntensity: OverlayIntensity =
    brandOverlayRaw === 'none' || brandOverlayRaw === 'subtle' ||
    brandOverlayRaw === 'medium' || brandOverlayRaw === 'strong'
      ? brandOverlayRaw
      : 'medium';

  const ctx: RenderCtx = {
    copy:             clamp(idea.copy_draft ?? '', 300),
    brandName:        brand.name,
    primary:          colors['primary']  ?? '#0F766E',
    secondary:        colors['secondary'] ?? '#374151',
    logoUrl:          (brand as unknown as Record<string, unknown>).logo_url as string | null ?? null,
    bgImageUrl,
    overlayIntensity,
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
