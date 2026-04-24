# Phase 0.C — Fonts catalog

**Date:** 2026-04-24
**Goal:** connect `brands.fonts` (JSONB column, editable in brand kit) to the story renderer, with a curated catalog of Google Fonts and a strict fallback.

## Catalog

11 fonts total — 6 display + 5 body. All validated to have a TTF reachable via the Android User-Agent trick that `fetchBunnyFont` uses in `render.tsx` (satori requires TTF, not WOFF2).

### Display (6)

| id | Google family | weight | description |
|---|---|---|---|
| `barlow_condensed` | Barlow Condensed | 900 | Deportivo, condensado, industrial |
| `archivo_black` | Archivo Black | 400 | Bold, impactante, urbano |
| `bebas_neue` | Bebas Neue | 400 | Condensado clásico, cartelera |
| `playfair_display` | Playfair Display | 900 | Editorial serif, sofisticado |
| `dm_serif_display` | DM Serif Display | 400 | Serif elegante, luxury |
| `syne` | Syne | 800 | Moderno, geométrico |

### Body (5)

| id | Google family | weight | description |
|---|---|---|---|
| `barlow` | Barlow | 700 | Versátil, neutro |
| `inter` | Inter | 600 | Tech, limpio, UI-friendly |
| `lato` | Lato | 700 | Humanista, cálido |
| `dm_sans` | DM Sans | 500 | Minimalista moderno |
| `source_sans_3` | Source Sans 3 | 600 | Editorial neutral |

Source: `src/lib/stories/fonts-catalog.ts`.

## Defaults

```ts
DEFAULT_DISPLAY_ID = 'barlow_condensed'
DEFAULT_BODY_ID    = 'barlow'
```

These match the fonts hardcoded prior to Fase 0.C, so brands without `fonts` configured render identically to before.

## How resolution works

`resolveFont(id, role)` in `fonts-catalog.ts`:

1. If `id` is a non-empty string AND matches an entry in `FONT_CATALOG` with the given `role` → return that entry.
2. Otherwise → return the default for that role.

Applied in `renderStory` (`render.tsx`):

```ts
const brandFonts = (brand.fonts ?? null) as { heading?: string; body?: string } | null;
const displayFont = resolveFont(brandFonts?.heading, 'display');
const bodyFont    = resolveFont(brandFonts?.body,    'body');
```

So:
- `brand.fonts = null` → Barlow Condensed 900 + Barlow 700.
- `brand.fonts = {heading: 'playfair_display', body: 'inter'}` → Playfair 900 + Inter 600.
- `brand.fonts = {heading: 'nonexistent', body: 'fake'}` → falls back to defaults.
- `brand.fonts = {heading: 'Cabinet Grotesk', body: 'Literata'}` (legacy editor values) → falls back to defaults. **No data migration needed.**

## How to add a new font

1. Add an entry to `FONT_CATALOG` in `src/lib/stories/fonts-catalog.ts` with the id, Google family name, weight and role.
2. Verify the TTF is reachable with the Android UA trick — run the temporary probe script (recreate it if deleted):

   ```ts
   // scripts/verify-fonts-ttf-available.ts
   import { FONT_CATALOG } from '../src/lib/stories/fonts-catalog';
   // ... probe each font.google_family at its weight and confirm a .ttf URL is returned.
   ```

   If the font does not return a TTF at the requested weight, try a different weight that the family actually ships, or pick a different font.
3. Commit the catalog change. No changes to `render.tsx` required — the loader is data-driven.

## Font cache

`render.tsx` keeps a module-level `Map<string, ArrayBuffer>` keyed by font id. Across renders (even across brands) the same font ArrayBuffer is reused — only new fonts trigger a fetch to Google Fonts.

## Caveats

- **Google Fonts TTF availability**: the Android UA trick depends on Google serving TTF when that UA asks. If Google stops doing so, we need to self-host the TTFs. Current fallback: the renderer throws if a TTF URL is not found in the CSS response, so brands using the affected font get a visible error in render, not a silent fallback.
- **Legal**: all 11 fonts are OFL or free under Google Fonts TOS, redistribution via `ImageResponse` is allowed.
- **Weights**: the catalog fixes one weight per id. If a future brand needs e.g. "Barlow at weight 400" separately from "Barlow at weight 700", that is a different catalog entry (new id).
- **Single-weight families**: `Archivo Black` only ships at weight 400. Requesting 900 returns no TTF. That is why `archivo_black` is `weight: 400` in the catalog (despite the family name suggesting black/900).

## Verification

`scripts/verify-phase0-fonts.ts` renders a story 3 times and confirms:

1. `fonts = null` → PNG hash A (fallback).
2. `fonts = {playfair_display, inter}` → PNG hash B, **different** from A (custom fonts applied).
3. `fonts = {nonexistent, fake}` → PNG hash C, **equal** to A (invalid ids fall back).

Run:

```bash
npx tsx --tsconfig tsconfig.json scripts/verify-phase0-fonts.ts
```

Expected output: `All 3 font-rendering tests passed.`
